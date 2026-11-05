// 분석 파이프라인 단계. connected는 그 단계가 실제로 동작하는지를 뜻한다. (현재 GitHub 조회만 true)
// 나머지 단계가 연결되면 해당 단계의 connected를 true로 바꾸고 상태를 서버 응답으로 채운다.
export const STAGES = [
  { id: "document", label: "문서 확인", description: "입력한 문서의 형식과 길이를 확인합니다.", connected: false },
  { id: "extract", label: "요구사항 추출", description: "문서에서 요구사항을 항목으로 나눕니다.", connected: false },
  { id: "github", label: "GitHub 조회", description: "공개 저장소의 파일과 코드를 가져옵니다.", connected: true },
  { id: "compare", label: "코드 비교", description: "요구사항과 코드를 항목별로 대조합니다.", connected: false },
  { id: "report", label: "결과 생성", description: "상태와 근거를 담은 리포트를 만듭니다.", connected: false },
] as const;

export type StageId = (typeof STAGES)[number]["id"];
export type StageState = "pending" | "running" | "done" | "error";

/** 단계 하나의 결과. 오류 메시지는 단계 단위로 받아 해당 단계 아래에 표시한다. */
export type StageResult = { state: StageState; error?: string };

// unavailable: 분석 API가 아직 없어 실행할 수 없는 상태
export type RunStatus = "unavailable" | "idle" | "running" | "done" | "error";
