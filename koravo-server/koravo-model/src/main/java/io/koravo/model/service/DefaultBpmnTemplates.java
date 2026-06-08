package io.koravo.model.service;

public final class DefaultBpmnTemplates {
    private DefaultBpmnTemplates() {
    }

    public static String approval(String processId, String processName) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                             xmlns:flowable="http://flowable.org/bpmn"
                             targetNamespace="https://koravo.io/model">
                  <process id="%s" name="%s" isExecutable="true">
                    <startEvent id="start" name="开始"/>
                    <sequenceFlow id="flow_start_submit" sourceRef="start" targetRef="submitTask"/>
                    <userTask id="submitTask" name="提交申请" flowable:assignee="${startUserId}"/>
                    <sequenceFlow id="flow_submit_end" sourceRef="submitTask" targetRef="end"/>
                    <endEvent id="end" name="结束"/>
                  </process>
                </definitions>
                """.formatted(escape(processId), escape(processName));
    }

    private static String escape(String value) {
        return value == null ? "" : value
                .replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
