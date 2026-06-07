package io.koravo.model.validation;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

@Service
public class BpmnValidationService {
    public BpmnValidationResult validate(String bpmnXml) {
        List<BpmnValidationIssue> errors = new ArrayList<>();
        List<BpmnValidationIssue> warnings = new ArrayList<>();
        if (!StringUtils.hasText(bpmnXml)) {
            errors.add(new BpmnValidationIssue("BPMN_XML_REQUIRED", "BPMN XML is required", null));
            return BpmnValidationResult.of(errors, warnings);
        }

        Document document;
        try {
            document = parse(bpmnXml);
        } catch (Exception e) {
            errors.add(new BpmnValidationIssue("BPMN_XML_INVALID", "BPMN XML is not well formed", null));
            return BpmnValidationResult.of(errors, warnings);
        }

        NodeList definitions = document.getElementsByTagNameNS("*", "definitions");
        if (definitions.getLength() == 0) {
            errors.add(new BpmnValidationIssue("BPMN_DEFINITIONS_MISSING", "BPMN definitions element is required", null));
        }

        NodeList processes = document.getElementsByTagNameNS("*", "process");
        if (processes.getLength() == 0) {
            errors.add(new BpmnValidationIssue("BPMN_PROCESS_MISSING", "At least one process is required", null));
        }

        for (int i = 0; i < processes.getLength(); i++) {
            Element process = (Element) processes.item(i);
            String processId = process.getAttribute("id");
            if (!StringUtils.hasText(processId)) {
                errors.add(new BpmnValidationIssue("BPMN_PROCESS_ID_MISSING", "Process id is required", null));
            }
            if (!"true".equalsIgnoreCase(process.getAttribute("isExecutable"))) {
                warnings.add(new BpmnValidationIssue(
                        "BPMN_PROCESS_NOT_EXECUTABLE",
                        "Process " + (StringUtils.hasText(processId) ? processId : "<unknown>") + " is not executable",
                        processId
                ));
            }
        }

        if (document.getElementsByTagNameNS("*", "startEvent").getLength() == 0) {
            errors.add(new BpmnValidationIssue("BPMN_START_EVENT_MISSING", "At least one startEvent is required", null));
        }
        if (document.getElementsByTagNameNS("*", "endEvent").getLength() == 0) {
            warnings.add(new BpmnValidationIssue("BPMN_END_EVENT_MISSING", "No endEvent found", null));
        }
        return BpmnValidationResult.of(errors, warnings);
    }

    private Document parse(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
    }
}
