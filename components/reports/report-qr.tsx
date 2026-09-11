import QRCode from 'qrcode';

/**
 * QR code for the public verification URL.
 *
 * Rendered server-side to an inline SVG: no QR library reaches the browser,
 * and the code prints correctly. The QR encodes only the verification URL -
 * never report content, personal data or internal identifiers.
 */
export default async function ReportQr({
  verificationUrl,
  size = 120,
}: {
  verificationUrl: string;
  size?: number;
}) {
  let svg: string;
  try {
    svg = await QRCode.toString(verificationUrl, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      width: size,
    });
  } catch {
    return null;
  }

  return (
    <div
      aria-label="QR code linking to the public verification page for this report"
      role="img"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
