import { MintForm } from "../../buyback/settings/mint-form";
import { Card, PageHead } from "../../dashboard/_ui/shell";
import { adminMeta } from "../meta";

export const metadata = adminMeta("$GOBLOCK", "/admin/mint", "Set the mint the goblock program buys and burns.");

export default function AdminMintPage() {
  return (
    <>
      <PageHead
        title="$GOBLOCK"
        sub="The mint the program buys and burns. The team wallet signs the transaction, and the address locks after it lands."
      />
      <Card plain title="Mint address" sub="Taken from the on-chain config. It cannot be edited once it is set.">
        <MintForm />
      </Card>
    </>
  );
}
