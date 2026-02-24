// @types/jstat 파일이 존재하지 않아 발생하는 오류를 방지하기 위해 Mocking 선언합니다.

declare module 'jstat' {
    export const beta: {
        sample(alpha: number, beta: number): number;
    };
}
