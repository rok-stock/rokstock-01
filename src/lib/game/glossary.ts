/**
 * 용어 사전 — ConceptTip(탭하면 뜨는 짧은 설명)의 데이터.
 * 자세한 내용은 docs/learning/ 노트에 있고, 여기는 화면에서 읽을 두세 문장만 담는다.
 */

export interface GlossaryEntry {
  term: string;
  description: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  avgPrice: {
    term: "평단가",
    description:
      "여러 번 나눠 산 주식의 평균 매입 가격. 총 매입금액 ÷ 보유 수량으로 계산해요. 현재가가 평단가보다 높으면 평가이익 상태입니다.",
  },
  unrealizedPnl: {
    term: "평가손익",
    description:
      "지금 팔았다면 얼마나 벌었을지(잃었을지)를 보여주는 미확정 손익. 시세 따라 매일 출렁이고, 실제로 매도해야 실현손익으로 확정됩니다.",
  },
  realizedPnl: {
    term: "실현손익",
    description:
      "매도가 체결되는 순간 확정되는 손익. 수수료와 세금을 뺀 값이라, 여기서 플러스여야 진짜 남는 장사입니다.",
  },
  fees: {
    term: "수수료·세금",
    description:
      "살 때/팔 때 위탁수수료 0.015%씩, 팔 때는 농어촌특별세 0.15%가 추가로 붙어요. 사고팔기만 반복해도 약 0.18%씩 새어 나갑니다.",
  },
  benchmark: {
    term: "벤치마크",
    description:
      "내 성과를 비교할 기준. 개별 종목을 고르는 대신 시장 전체(KOSPI 지수)를 샀다면 어땠을지와 비교해요. 벤치마크를 꾸준히 이기는 건 전문가에게도 어렵습니다.",
  },
  closingPrice: {
    term: "종가",
    description:
      "그날 장이 끝날 때(15:30)의 가격. 이 게임의 모든 시세와 체결은 종가 기준입니다 — 공공데이터가 하루 단위로만 오기 때문이에요.",
  },
  per: {
    term: "PER (주가수익비율)",
    description:
      "시가총액 ÷ 연간 순이익. \"이 회사가 지금 버는 속도로 몇 년을 벌어야 회사값이 되나\"입니다. 낮을수록 싸 보이지만, 이익이 줄어드는 회사는 싼 이유가 있는 법 — 숫자 하나로 결론 내리면 위험해요.",
  },
  pbr: {
    term: "PBR (주가순자산비율)",
    description:
      "시가총액 ÷ 자본총계(순자산). 1보다 작으면 \"회사를 통째로 사서 청산해도 남는\" 가격이라는 뜻이지만, 장부가치가 실제 가치와 다를 수 있어 역시 참고 지표입니다.",
  },
};
