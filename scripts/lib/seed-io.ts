import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 시드 JSON 직렬화 헬퍼.
 *
 * 시드 파일은 용량을 줄이려고 객체 배열 대신 **필드 헤더 + 튜플 행** 형식을 쓴다.
 * (키 이름이 행마다 반복되지 않아 raw 기준 절반 이하로 줄어든다)
 * 행을 한 줄에 하나씩 두면 git diff 로 변경분을 읽을 수 있다.
 */

/** 튜플 행 배열을 "한 줄에 한 행" JSON 배열 문자열로 만든다 */
export function stringifyRows(rows: unknown[][]): string {
  if (rows.length === 0) return "[]";
  return `[\n${rows.map((row) => JSON.stringify(row)).join(",\n")}\n]`;
}

export function writeSeedFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content.trimEnd()}\n`, "utf8");
  console.log(`  ✓ ${path} (${(content.length / 1024).toFixed(1)}KB)`);
}
