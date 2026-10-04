from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.ocr_engine import LandIQOCR


app = FastAPI(
    title="LAND-IQ Local OCR Service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


ocr_engine = LandIQOCR()


ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/tiff",
}

ALLOWED_PDF_TYPES = {
    "application/pdf",
}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "land-iq-ocr",
        "engine": "PaddleOCR",
        "mode": "local",
    }


@app.post("/ocr")
async def process_document(file: UploadFile = File(...)):
    """
    Process an uploaded image or PDF.

    Returns the LAND-IQ OCR contract:

    {
        "pages": [
            {
                "page_number": 1,
                "text": "...",
                "fields": {}
            }
        ]
    }
    """

    content_type = file.content_type or ""

    if (
        content_type not in ALLOWED_IMAGE_TYPES
        and content_type not in ALLOWED_PDF_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}",
        )

    extension = Path(file.filename or "").suffix.lower()

    if not extension:
        extension = ".pdf" if content_type == "application/pdf" else ".png"

    with TemporaryDirectory() as temp_dir:
        input_path = Path(temp_dir) / f"document{extension}"

        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )

        input_path.write_bytes(contents)

        # Image document
        if content_type in ALLOWED_IMAGE_TYPES:
            page = ocr_engine.process_image(
                str(input_path),
                page_number=1,
            )

            return {
                "pages": [page]
            }

        # PDF document
        if content_type == "application/pdf":
            return process_pdf(str(input_path), temp_dir)


def process_pdf(pdf_path: str, temp_dir: str):
    """
    Convert PDF pages to images and OCR each page.
    """

    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(pdf_path)

    pages = []

    try:
        for index in range(len(pdf)):
            page_number = index + 1

            page = pdf[index]

            bitmap = page.render(
                scale=2.0,
            )

            image_path = Path(temp_dir) / f"page_{page_number}.png"

            bitmap.to_pil().save(image_path)

            result = ocr_engine.process_image(
                str(image_path),
                page_number=page_number,
            )

            pages.append(result)

    finally:
        pdf.close()

    return {
        "pages": pages
    }