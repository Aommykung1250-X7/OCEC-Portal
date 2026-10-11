import tesseractWorkerUrl from "tesseract.js/dist/worker.min.js?url";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerPromise;

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function matchAccount(text, accounts) {
  const lines = String(text || "").split(/\r?\n/);
  const groups = lines.flatMap((line) => (line.match(/\d[\d\s.,-]{2,}\d/g) || []))
    .map((value) => value.replace(/\D/g, ""))
    .filter((value) => value.length >= 4);
  const strictMatches = accounts.filter((account) => {
    const accountDigits = digits(account.accountNumber);
    return accountDigits.length >= 4 && groups.some((group) => group === accountDigits || group.endsWith(accountDigits));
  });
  if (strictMatches.length === 1) return { account: strictMatches[0], matchType: "full-number" };
  if (strictMatches.length > 1) return null;

  const accountLines = lines.filter((line) => /[xX*•]|account|recipient|transfer\s+to|\bto\b|บัญชี|ปลายทาง|รับโอน|เลขบัญชี/i.test(line));
  const accountGroups = accountLines.flatMap((line) => (line.match(/\d[\d\s.,-]{2,}\d/g) || []))
    .map((value) => value.replace(/\D/g, ""))
    .filter((value) => value.length >= 4);
  const suffixMatches = accounts.filter((account) => {
    const lastFour = digits(account.accountNumber).slice(-4);
    return lastFour.length === 4 && accountGroups.some((group) => group.length <= 5 && group.endsWith(lastFour));
  });
  return suffixMatches.length === 1 ? { account: suffixMatches[0], matchType: "account-suffix" } : null;
}

async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker, OEM }) => createWorker("eng", OEM.LSTM_ONLY, {
      workerPath: tesseractWorkerUrl,
      logger: () => {},
    }).then(async (worker) => {
      await worker.setParameters({ tessedit_char_whitelist: "0123456789xX-., " });
      return worker;
    })).catch((error) => {
      workerPromise = undefined;
      throw error;
    });
  }
  return workerPromise;
}

async function readPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const text = textContent.items.map((item) => `${item.str || ""}${item.hasEOL ? "\n" : " "}`).join("");
  const viewport = page.getViewport({ scale: 2.5 });
  return { text, page, viewport };
}

async function renderPdfPage(page, viewport) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas;
}

export async function detectPaymentAccount(file, accounts) {
  const availableAccounts = (accounts || []).filter((account) => digits(account.accountNumber).length >= 4);
  if (!file?.dataUrl || !availableAccounts.length) return { status: "unmatched", account: null, text: "" };

  let image = file.dataUrl;
  let text = "";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
    const pdfResult = await readPdf(await (await fetch(file.dataUrl)).blob());
    text = pdfResult.text;
    const textMatch = matchAccount(text, availableAccounts);
    if (textMatch) return { status: "matched", ...textMatch, text };
    image = await renderPdfPage(pdfResult.page, pdfResult.viewport);
  }

  const worker = await getOcrWorker();
  const result = await worker.recognize(image);
  text = [text, result.data.text].filter(Boolean).join("\n");
  const match = matchAccount(text, availableAccounts);
  return match && Number(result.data.confidence || 0) >= 40
    ? { status: "matched", ...match, confidence: Number(result.data.confidence || 0), text }
    : { status: "unmatched", account: null, confidence: Number(result.data.confidence || 0), text };
}
