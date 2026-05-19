package com.capstone.interview.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * PDF 파일을 텍스트로 변환하는 서비스.
 * Apache PDFBox 3.x를 사용한다.
 */
@Slf4j
@Service
public class PdfParserService {

    /**
     * 업로드된 PDF 파일에서 텍스트를 추출한다.
     * PDFBox 3.x에서는 Loader.loadPDF(byte[])를 사용해야 한다.
     *
     * @param file 업로드된 PDF 파일
     * @return 추출된 텍스트
     * @throws IOException PDF 읽기 실패 시
     */
    public String extractText(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        try (PDDocument document = Loader.loadPDF(bytes)) {

            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);

            String cleanedText = text.replace("\u0000", "");
            log.info("[PDF 파싱] 완료: {}페이지, {}글자", document.getNumberOfPages(), cleanedText.length());
            return cleanedText.trim();
        }
    }
}
