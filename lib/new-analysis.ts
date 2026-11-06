// '새 분석' 요청 처리. 같은 /analyze 경로에서도 화면을 새로 시작할 수 있도록, 링크가 이벤트를 보내면
// 분석 화면이 자신의 세션을 새로 만든다. (세션이 바뀌면 입력, 첨부, 결과, 진행 중인 요청이 모두 사라진다.)
export const NEW_ANALYSIS_EVENT = "catchup:new-analysis";

export type AnalysisActivity = {
  /** 요청이나 파일 추출이 진행 중 */
  busy: boolean;
  /** 사용자가 입력한 내용이 있음 */
  dirty: boolean;
  /** 코드 비교까지 끝나 리포트가 저장됨 */
  completed: boolean;
};

const IDLE: AnalysisActivity = { busy: false, dirty: false, completed: false };
let activity: AnalysisActivity = IDLE;

export const setAnalysisActivity = (a: AnalysisActivity) => {
  activity = a;
};
export const resetAnalysisActivity = () => {
  activity = IDLE;
};
export const getAnalysisActivity = () => activity;

/**
 * 진행 중인 요청이 있거나, 입력만 하고 아직 분석을 끝내지 않았다면 확인을 받는다.
 * 이미 끝난 분석에서 새로 시작할 때는 묻지 않는다.
 */
export function needsConfirm(a: AnalysisActivity): boolean {
  return a.busy || (a.dirty && !a.completed);
}

export const NEW_ANALYSIS_CONFIRM = "작성 중인 내용과 진행 중인 분석이 사라집니다. 새 분석을 시작할까요?";
