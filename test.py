from pathlib import Path
import PyPDF2

def extract_text_from_pdf(path):
    text = []
    try:
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                raw = page.extract_text()
                print("RAW PAGE TEXT:", repr(raw))  # <-- debug print
                if raw:
                    text.append(raw)
    except Exception as e:
        print(f"PDF extraction error: {e}")
    return "\n".join(text)

print(extract_text_from_pdf(Path(r"C:\Users\user\Desktop\LPEE BOT\backend\files\person.pdf")))
