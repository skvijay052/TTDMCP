import { readFile } from "node:fs/promises";

export interface Pilgrim {
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  idType?: string;
  idNumber?: string;
}

export interface Profile {
  profileName: string;
  pilgrims: Pilgrim[];
}

export async function loadProfile(file = "./profiles/default.json"): Promise<Profile> {
  return JSON.parse(await readFile(file, "utf8")) as Profile;
}
