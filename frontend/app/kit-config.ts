let projectId = "";

export function setKitProject(id: string) {
  projectId = id;
}

export function kitProject() {
  return projectId;
}
