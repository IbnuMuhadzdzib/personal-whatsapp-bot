declare module "qrcode-terminal" {
  export function generate(
    qr: string,
    options?: { small?: boolean },
    callback?: (qrAscii: string) => void
  ): void;
}