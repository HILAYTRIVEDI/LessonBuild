export type WorkflowEventStatus = "pending" | "success" | "error" | "info";

export type WorkflowEventStep =
  | "upload"
  | "pdf_extract"
  | "database"
  | "session"
  | "agent_start"
  | "agent_interrupt"
  | "question"
  | "report";

export type WorkflowEvent = {
  id: string;
  step: WorkflowEventStep;
  title: string;
  status: WorkflowEventStatus;
  timestamp: string;
  source: {
    component?: string;
    hook?: string;
    function?: string;
    endpoint?: string;
    database?: string;
    agentNode?: string;
  };
  data?: Record<string, unknown>;
  reason: string;
};

export type UploadWorkflowDebug = {
  filename: string;
  title: string;
  sizeBytes: number;
  mimeType: string;
  extractedCharacters: number;
  chunkCount: number;
  database: {
    lessonTable: string;
    chunkTable: string;
    lessonId: string;
  };
  functions: {
    uploadHandler: string;
    pdfExtractor: string;
    chunker: string;
    persistence: string;
  };
};

export type UploadLessonResult = {
  lessonId: string;
  title?: string | undefined;
  workflow?: UploadWorkflowDebug | undefined;
};

export const WORKFLOW_BLUEPRINT: WorkflowEvent[] = [
  {
    id: "blueprint-upload",
    step: "upload",
    title: "PDF selected in the dashboard",
    status: "info",
    timestamp: "",
    source: {
      component: "apps/web/app/page.tsx",
      hook: "useLessonDashboard.upload()",
      function: "uploadLessonPdf(file)",
    },
    data: { passedData: "File -> FormData { file }" },
    reason: "This starts a lesson without exposing raw PDF content to the client after upload.",
  },
  {
    id: "blueprint-api",
    step: "upload",
    title: "Upload API receives the PDF",
    status: "info",
    timestamp: "",
    source: {
      endpoint: "POST /api/upload",
      function: "POST(req)",
    },
    data: { validation: "PDF MIME/name, size limit, PDF header" },
    reason: "The server validates the file before doing expensive parsing or database writes.",
  },
  {
    id: "blueprint-pdf",
    step: "pdf_extract",
    title: "PDF text is extracted and chunked",
    status: "info",
    timestamp: "",
    source: {
      function: "extractText(data) -> chunkText(docText)",
    },
    data: { passedData: "Uint8Array PDF bytes -> docText -> ordered chunks" },
    reason: "Agents and retrieval need text, while chunking creates smaller searchable windows.",
  },
  {
    id: "blueprint-db",
    step: "database",
    title: "Lesson and chunks are stored in Postgres",
    status: "info",
    timestamp: "",
    source: {
      function: "createLesson({ title, sourceFilename, docText, chunks })",
      database: "lessons, lesson_chunks",
    },
    data: { storedFields: "title, source_filename, doc_text, chunk ord/content" },
    reason: "The full document stays in `lessons`; chunks support coach and generation retrieval.",
  },
  {
    id: "blueprint-session",
    step: "session",
    title: "Lesson identity is synced",
    status: "info",
    timestamp: "",
    source: {
      hook: "useLessonDashboard.syncLesson()",
      function: "saveLessonId(), setAgentState()",
    },
    data: { destinations: "localStorage, cookie, Copilot agent state" },
    reason: "Refreshes and server-side agent calls need the same lesson id.",
  },
  {
    id: "blueprint-agent-start",
    step: "agent_start",
    title: "Learner starts the LangGraph run",
    status: "info",
    timestamp: "",
    source: {
      hook: "useLessonDashboard.start()",
      function: "agent.setState(), copilotkit.runAgent({ agent })",
    },
    data: { passedData: "{ lessonId, report }" },
    reason: "The graph receives only the lesson id and loads trusted document data server-side.",
  },
  {
    id: "blueprint-hydrate",
    step: "agent_start",
    title: "Agent hydrates the lesson",
    status: "info",
    timestamp: "",
    source: {
      agentNode: "hydrate",
      function: "hydrateNode(state) -> getLesson(lessonId)",
      database: "lessons",
    },
    data: { passedData: "lessonId -> persisted lesson row" },
    reason: "Hydration verifies the uploaded lesson exists before planning begins.",
  },
  {
    id: "blueprint-plan",
    step: "agent_interrupt",
    title: "Plan is generated and sent for approval",
    status: "info",
    timestamp: "",
    source: {
      agentNode: "plan -> approvePlan",
      component: "PlanApprovalCard",
      database: "objectives",
    },
    data: { passedData: "LessonPlan -> approve_plan interrupt -> approval response" },
    reason: "A human reviews the lesson structure before questions are generated.",
  },
  {
    id: "blueprint-question",
    step: "question",
    title: "Question loop runs until complete",
    status: "info",
    timestamp: "",
    source: {
      agentNode: "generateQuestions -> askQuestion -> evaluate -> advance",
      component: "McqWidget",
      database: "questions, attempts",
    },
    data: { passedData: "Safe MCQ -> selectedIndex -> feedback/continue" },
    reason: "The UI receives safe question data while answers and attempts stay server-side.",
  },
  {
    id: "blueprint-report",
    step: "report",
    title: "Final report is produced",
    status: "info",
    timestamp: "",
    source: {
      agentNode: "summarize",
      component: "ProgressReport",
    },
    data: { passedData: "attempts + objectives -> report string" },
    reason: "The learner gets a final performance summary and study guidance.",
  },
];
