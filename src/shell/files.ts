/** Browser file IO: trigger a download, read a picked file. */

export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readFileText(file: Blob): Promise<string> {
  return file.text();
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
