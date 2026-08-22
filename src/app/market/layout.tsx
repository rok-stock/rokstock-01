import MarketSubNav from "@/components/MarketSubNav";

/**
 * /market 하위 뷰 공용 레이아웃 — 서브내비만 얹는다.
 *
 * <main> 은 각 page.tsx 가 소유한다 (루트 레이아웃과 같은 관례) —
 * 여기서 children 을 <main> 으로 감싸면 문서에 main 랜드마크가 중첩된다.
 */
export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="container-page px-6 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight">시장</h1>
        <div className="mt-4">
          <MarketSubNav />
        </div>
      </div>
      {children}
    </>
  );
}
