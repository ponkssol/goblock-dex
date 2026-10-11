#![no_std]

use core::mem::MaybeUninit;
use pinocchio::{
    cpi::invoke_with_bounds,
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    no_allocator, nostd_panic_handler, program_entrypoint, AccountView, Address, ProgramResult,
};
use solana_program_log::log;

program_entrypoint!(process_instruction);
no_allocator!();
nostd_panic_handler!();

#[used]
static SECURITY_TXT: &str = "\
=======BEGIN SECURITY.TXT V1=======
name: goblock
project_url: https://github.com/ponkssol/goblock-dex
contacts: link:https://github.com/ponkssol/goblock-program
policy: https://github.com/ponkssol/goblock-program
preferred_languages: en
source_code: https://github.com/ponkssol/goblock-program
logo: https://raw.githubusercontent.com/ponkssol/goblock-program/main/logo.png
=======END SECURITY.TXT V1=======
";

const CHECKED: u8 = 1;
const MAX_INNER: usize = 16;
const MAX_ACCOUNTS: usize = 32;
const BELOW_FLOOR: u32 = 1;
const FEE_REJECTED: u32 = 2;
const FEE_CAP: u64 = 2_000_000_000;

fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    core::hint::black_box(SECURITY_TXT);
    let signer = accounts.first().ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !signer.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let tag = data.first().copied().ok_or(ProgramError::InvalidInstructionData)?;
    log("goblock:");
    if tag != CHECKED {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut cursor = 1;

    let output_index = read_u8(data, &mut cursor)? as usize;
    let min_out = read_u64(data, &mut cursor)?;
    let mint = read_pubkey(data, &mut cursor)?;
    let fee = read_u64(data, &mut cursor)?;
    let treasury_fee = read_u64(data, &mut cursor)?;
    let system_index = read_u8(data, &mut cursor)? as usize;
    let treasury_index = read_u8(data, &mut cursor)? as usize;
    let brand_index = read_u8(data, &mut cursor)? as usize;
    if output_index == 0 || !accounts.get(output_index).is_some_and(|account| account.is_writable()) {
        return Err(ProgramError::InvalidAccountData);
    }
    let before = token_amount(&accounts[output_index])?;
    let pre_count = read_u8(data, &mut cursor)? as usize;
    let post_count = read_u8(data, &mut cursor)? as usize;
    if pre_count.saturating_add(post_count) == 0 || pre_count.saturating_add(post_count) > MAX_INNER {
        return Err(ProgramError::InvalidInstructionData);
    }
    for _ in 0..pre_count {
        forward(program_id, accounts, data, &mut cursor)?;
    }
    let output = &accounts[output_index];
    let (found_mint, owner, after) = token_fields(output)?;
    if found_mint != mint || owner != *signer.address().as_array() {
        return Err(ProgramError::InvalidAccountData);
    }
    let need = before.checked_add(min_out).ok_or(ProgramError::InvalidInstructionData)?;
    if after < need {
        return Err(ProgramError::Custom(BELOW_FLOOR));
    }
    for _ in 0..post_count {
        forward(program_id, accounts, data, &mut cursor)?;
    }
    take_fee(accounts, fee, treasury_fee, system_index, treasury_index, brand_index)?;
    if cursor != data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(())
}

fn take_fee(
    accounts: &[AccountView],
    fee: u64,
    treasury_fee: u64,
    system_index: usize,
    treasury_index: usize,
    brand_index: usize,
) -> ProgramResult {
    if fee == 0 {
        return Ok(());
    }
    if fee > FEE_CAP || treasury_fee > fee {
        return Err(ProgramError::Custom(FEE_REJECTED));
    }
    let system = accounts.get(system_index).ok_or(ProgramError::NotEnoughAccountKeys)?;
    if system.address().as_array() != &[0; 32] {
        return Err(ProgramError::IncorrectProgramId);
    }
    let treasury = accounts.get(treasury_index).ok_or(ProgramError::NotEnoughAccountKeys)?;
    let brand = accounts.get(brand_index).ok_or(ProgramError::NotEnoughAccountKeys)?;
    if !treasury.is_writable() || !brand.is_writable() || treasury_index == 0 || brand_index == 0 {
        return Err(ProgramError::Custom(FEE_REJECTED));
    }
    let payer = &accounts[0];
    if treasury_index == brand_index {
        if treasury_fee != fee {
            return Err(ProgramError::Custom(FEE_REJECTED));
        }
        return transfer(payer, treasury, fee, system);
    }
    if treasury_fee > 0 {
        transfer(payer, treasury, treasury_fee, system)?;
    }
    let brand_fee = fee - treasury_fee;
    if brand_fee > 0 {
        transfer(payer, brand, brand_fee, system)?;
    }
    Ok(())
}

fn transfer(from: &AccountView, to: &AccountView, lamports: u64, system: &AccountView) -> ProgramResult {
    let mut data = [0; 12];
    data[0] = 2;
    data[4..12].copy_from_slice(&lamports.to_le_bytes());
    let metas = [
        InstructionAccount::new(from.address(), true, true),
        InstructionAccount::new(to.address(), true, false),
    ];
    let instruction = InstructionView {
        program_id: system.address(),
        data: &data,
        accounts: &metas,
    };
    invoke_with_bounds::<2, _>(&instruction, &[from, to])
}

fn token_fields(account: &AccountView) -> Result<([u8; 32], [u8; 32], u64), ProgramError> {
    let data = account.try_borrow()?;
    if data.len() < 72 {
        return Err(ProgramError::InvalidAccountData);
    }
    let mut mint = [0; 32];
    let mut owner = [0; 32];
    mint.copy_from_slice(&data[0..32]);
    owner.copy_from_slice(&data[32..64]);
    let mut amount = [0; 8];
    amount.copy_from_slice(&data[64..72]);
    Ok((mint, owner, u64::from_le_bytes(amount)))
}

fn token_amount(account: &AccountView) -> Result<u64, ProgramError> {
    let data = account.try_borrow()?;
    if data.len() < 72 {
        return Ok(0);
    }
    let mut bytes = [0; 8];
    bytes.copy_from_slice(&data[64..72]);
    Ok(u64::from_le_bytes(bytes))
}

fn read_pubkey(data: &[u8], cursor: &mut usize) -> Result<[u8; 32], ProgramError> {
    let bytes = data.get(*cursor..*cursor + 32).ok_or(ProgramError::InvalidInstructionData)?;
    *cursor += 32;
    let mut raw = [0; 32];
    raw.copy_from_slice(bytes);
    Ok(raw)
}

fn read_u64(data: &[u8], cursor: &mut usize) -> Result<u64, ProgramError> {
    let bytes = data.get(*cursor..*cursor + 8).ok_or(ProgramError::InvalidInstructionData)?;
    *cursor += 8;
    let mut raw = [0; 8];
    raw.copy_from_slice(bytes);
    Ok(u64::from_le_bytes(raw))
}

fn forward(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
    cursor: &mut usize,
) -> ProgramResult {
    let program_index = read_u8(data, cursor)? as usize;
    let program = accounts.get(program_index).ok_or(ProgramError::NotEnoughAccountKeys)?;
    if program.address() == program_id || !allowed(program.address()) {
        return Err(ProgramError::IncorrectProgramId);
    }

    let account_count = read_u8(data, cursor)? as usize;
    if account_count > MAX_ACCOUNTS {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut raw_metas: [MaybeUninit<InstructionAccount>; MAX_ACCOUNTS] = [const { MaybeUninit::uninit() }; MAX_ACCOUNTS];
    let mut views = [accounts[0]; MAX_ACCOUNTS];
    for slot in 0..account_count {
        let index = read_u8(data, cursor)? as usize;
        let account = accounts.get(index).ok_or(ProgramError::NotEnoughAccountKeys)?;
        raw_metas[slot].write(InstructionAccount::new(
            account.address(),
            account.is_writable(),
            account.is_signer(),
        ));
        views[slot] = *account;
    }
    let metas = unsafe { core::slice::from_raw_parts(raw_metas.as_ptr() as *const InstructionAccount, account_count) };

    let data_len = read_u16(data, cursor)? as usize;
    let instruction_data = data.get(*cursor..*cursor + data_len).ok_or(ProgramError::InvalidInstructionData)?;
    *cursor += data_len;

    let instruction = InstructionView {
        program_id: program.address(),
        data: instruction_data,
        accounts: &metas,
    };
    invoke_with_bounds::<MAX_ACCOUNTS, _>(&instruction, &views[..account_count])
}

fn allowed(address: &Address) -> bool {
    ALLOWED.iter().any(|item| item == address.as_array())
}

fn read_u8(data: &[u8], cursor: &mut usize) -> Result<u8, ProgramError> {
    let byte = data.get(*cursor).copied().ok_or(ProgramError::InvalidInstructionData)?;
    *cursor += 1;
    Ok(byte)
}

fn read_u16(data: &[u8], cursor: &mut usize) -> Result<u16, ProgramError> {
    let bytes = data.get(*cursor..*cursor + 2).ok_or(ProgramError::InvalidInstructionData)?;
    *cursor += 2;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

const ALLOWED: [[u8; 32]; 16] = [
    [0; 32],
    TOKEN,
    TOKEN_2022,
    ASSOCIATED_TOKEN,
    MEMO,
    PUMP,
    PUMP_AMM,
    RAYDIUM_V4,
    RAYDIUM_CLMM,
    RAYDIUM_CPMM,
    RAYDIUM_LAUNCHLAB,
    METEORA_DLMM,
    METEORA_DAMM_V1,
    METEORA_DAMM_V2,
    METEORA_DBC,
    ORCA_WHIRLPOOL,
];

const TOKEN: [u8; 32] = [
    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133, 237, 95, 91, 55, 145, 58,
    140, 245, 133, 126, 255, 0, 169,
];
const TOKEN_2022: [u8; 32] = [
    6, 221, 246, 225, 238, 117, 143, 222, 24, 66, 93, 188, 228, 108, 205, 218, 182, 26, 252, 77, 131, 185, 13, 39, 254,
    189, 249, 40, 216, 161, 139, 252,
];
const ASSOCIATED_TOKEN: [u8; 32] = [
    140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20, 142, 13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142,
    123, 216, 219, 233, 248, 89,
];
const MEMO: [u8; 32] = [
    5, 74, 83, 90, 153, 41, 33, 6, 77, 36, 232, 113, 96, 218, 56, 124, 124, 53, 181, 221, 188, 146, 187, 129, 228, 31,
    168, 64, 65, 5, 68, 141,
];
const PUMP: [u8; 32] = [
    1, 86, 224, 246, 147, 102, 90, 207, 68, 219, 21, 104, 191, 23, 91, 170, 81, 137, 203, 151, 245, 210, 255, 59, 101,
    93, 43, 182, 253, 109, 24, 176,
];
const PUMP_AMM: [u8; 32] = [
    12, 20, 222, 252, 130, 94, 198, 118, 148, 37, 8, 24, 187, 101, 64, 101, 244, 41, 141, 49, 86, 213, 113, 180, 212,
    248, 9, 12, 24, 233, 168, 99,
];
const RAYDIUM_V4: [u8; 32] = [
    75, 217, 73, 196, 54, 2, 195, 63, 32, 119, 144, 237, 22, 163, 82, 76, 161, 185, 151, 92, 241, 33, 162, 169, 12, 255,
    236, 125, 248, 182, 138, 205,
];
const RAYDIUM_CLMM: [u8; 32] = [
    165, 213, 202, 158, 4, 207, 93, 181, 144, 183, 20, 186, 47, 227, 44, 177, 89, 19, 63, 193, 193, 146, 183, 34, 87,
    253, 7, 211, 156, 176, 64, 30,
];
const RAYDIUM_CPMM: [u8; 32] = [
    169, 42, 90, 139, 79, 41, 89, 82, 132, 37, 80, 170, 147, 253, 91, 149, 181, 172, 230, 168, 235, 146, 12, 147, 148, 46,
    67, 105, 12, 32, 236, 115,
];
const METEORA_DLMM: [u8; 32] = [
    4, 233, 225, 47, 188, 132, 232, 38, 201, 50, 204, 233, 226, 100, 12, 206, 21, 89, 12, 28, 98, 115, 176, 146, 87, 8,
    186, 59, 133, 32, 176, 188,
];
const ORCA_WHIRLPOOL: [u8; 32] = [
    14, 3, 104, 95, 142, 144, 144, 83, 228, 88, 18, 28, 102, 245, 167, 106, 237, 199, 112, 106, 161, 28, 130, 248, 170,
    149, 42, 143, 43, 120, 121, 169,
];
const RAYDIUM_LAUNCHLAB: [u8; 32] = [
    5, 4, 59, 149, 77, 202, 38, 225, 239, 145, 181, 44, 79, 143, 137, 175, 138, 111, 90, 200, 198, 33, 86, 241, 113,
    207, 15, 33, 172, 81, 201, 34,
];
const METEORA_DAMM_V1: [u8; 32] = [
    204, 248, 2, 212, 204, 204, 132, 215, 251, 33, 181, 247, 59, 73, 216, 26, 22, 197, 180, 200, 142, 227, 35, 148,
    225, 201, 29, 53, 136, 204, 64, 128,
];
const METEORA_DAMM_V2: [u8; 32] = [
    9, 45, 33, 53, 101, 122, 21, 156, 43, 135, 212, 182, 106, 112, 219, 142, 151, 82, 56, 159, 247, 106, 175, 32, 108,
    237, 6, 58, 56, 249, 90, 237,
];
const METEORA_DBC: [u8; 32] = [
    9, 96, 12, 165, 36, 247, 177, 183, 214, 204, 177, 195, 151, 58, 160, 51, 13, 25, 3, 218, 96, 28, 201, 181, 222,
    227, 198, 98, 180, 202, 209, 73,
];
