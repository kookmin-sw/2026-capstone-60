package com.capstone.interview.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import org.apache.pdfbox.Loader; // 머지 오류 해결

import java.io.IOException;
import java.io.InputStream;

/**
 * PDF 파일을 텍스트로 변환하는 서비스.
 * Apache PDFBox를 사용한다.
 */
@Slf4j
@Service
public class PdfParserService {

    /**
     * 업로드된 PDF 파일에서 텍스트를 추출한다.
     *
     * @param file 업로드된 PDF 파일
     * @return 추출된 텍스트
     * @throws IOException PDF 읽기 실패 시
     */
    public String extractText(MultipartFile file) throws IOException {
        try (InputStream inputStream = file.getInputStream();
            PDDocument document = Loader.loadPDF(inputStream) // load를 Loader.loadPDF로!
            // PDDocument document = PDDocument.load(inputStream)) {

            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(document);

            log.info("[PDF 파싱] 완료: {}페이지, {}글자", document.getNumberOfPages(), text.length());
            return text.trim();
        }
    }
}
