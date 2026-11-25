import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const git = async (cwd: string, args: string[]): Promise<string> =>
  (await exec("git", args, { cwd })).stdout;

export const createBranch = (cwd: string, name: string) => git(cwd, ["checkout", "-b", name]);

export const diffStat = (cwd: string) => git(cwd, ["diff", "--stat"]);

export async function commitFiles(cwd: string, files: string[], message: string): Promise<void> {
  await git(cwd, ["add", "--", ...files]);
  await git(cwd, ["commit", "-m", message]);
}
