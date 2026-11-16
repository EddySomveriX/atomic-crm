/**
 * A gift certificate as a picture (PNG) the business sends to a client in
 * Telegram or prints: the business name, what it is for, the code and the
 * expiry date, on the colors of the business menu.
 */
export const drawCertificate = (lines: {
  business: string;
  title: string;
  value: string;
  recipient: string | null;
  code: string;
  until: string;
  background: string;
  mark: string;
  font: string;
}): string => {
  const width = 1200;
  const height = 675;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = lines.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = lines.mark;
  context.lineWidth = 6;
  context.strokeRect(36, 36, width - 72, height - 72);

  context.fillStyle = "#ffffff";
  context.font = `500 34px ${lines.font}`;
  context.fillText(lines.business, 90, 130);
  context.fillStyle = lines.mark;
  context.font = `600 64px ${lines.font}`;
  context.fillText(lines.title, 90, 230);
  context.fillStyle = "#ffffff";
  context.font = `700 96px ${lines.font}`;
  context.fillText(lines.value, 90, 360);
  if (lines.recipient) {
    context.font = `400 36px ${lines.font}`;
    context.fillText(lines.recipient, 90, 430);
  }
  context.font = `600 52px ${lines.font}`;
  context.fillText(lines.code, 90, 560);
  context.font = `400 30px ${lines.font}`;
  context.fillStyle = lines.mark;
  context.fillText(lines.until, 90, 605);
  return canvas.toDataURL("image/png");
};
