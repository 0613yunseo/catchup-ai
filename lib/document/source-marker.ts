// 여러 출처(직접 입력, 첨부파일)를 한 문서로 합칠 때 쓰는 출처 표시. 외부 의존성이 없다.
// AI가 이 표시를 원문 인용에 끼워 넣거나, 두 출처에 걸친 문장을 하나의 인용으로 만들 수 없게 인용 검증이 이 표시를 거부한다.
export const SOURCE_MARKER = /\[(?:첨부파일 \d+: [^\]\n]*|직접 입력)\]/;

export const DIRECT_HEADER = "[직접 입력]";
export const fileHeader = (index: number, name: string) => `[첨부파일 ${index}: ${name}]`;
