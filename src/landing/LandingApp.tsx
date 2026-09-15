import { useEffect, useState } from 'react';
import { landingConfig } from './config';
import { privacySections, termsSections, type LegalSection } from './legal';
import './landing.css';

const features = [
  ['01', '履歴が残る', '種目ごとの記録を時系列で。前回の重量も、積み上げた回数もすぐに振り返れます。'],
  ['02', 'ベストが見える', '最大重量や推定1RMを自動で整理。小さな自己ベストを見逃しません。'],
  ['03', '目標へ進める', '次に狙う重量と回数をセット。達成の履歴が、次の一回を後押しします。'],
  ['04', '成長を分析', '種目・部位ごとの頻度やボリュームを可視化。感覚を確かな手応えに変えます。'],
] as const;

function Brand() {
  return (
    <a className="brand" href="#/" aria-label="SmithNote トップへ">
      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
      <span>SmithNote</span>
    </a>
  );
}

function StoreButtons({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`store-buttons${compact ? ' store-buttons--compact' : ''}`}>
      <a className="store-button store-button--primary" href={`${import.meta.env.BASE_URL}app/`}>
        <small>ブラウザですぐに使う</small>
        <strong>アプリを使う</strong>
      </a>
      {landingConfig.appStoreUrl ? (
        <a className="store-button store-button--primary" href={landingConfig.appStoreUrl}>
          <small>Download on the</small>
          <strong>App Store</strong>
        </a>
      ) : (
        <span className="store-button store-button--muted">
          <small>App Store</small>
          <strong>近日公開</strong>
        </span>
      )}
      <span className="store-button store-button--muted">
        <small>Google Play</small>
        <strong>近日公開</strong>
      </span>
    </div>
  );
}

function PhoneMockup({ variant }: { variant: 'history' | 'analysis' }) {
  if (variant === 'history') {
    return (
      <div className="phone" aria-label="SmithNoteの種目履歴画面イメージ">
        <div className="phone-bar"><span>9:41</span><i /></div>
        <div className="phone-head"><span>‹</span><strong>ベンチプレス</strong><span>•••</span></div>
        <div className="record-card">
          <small>推定 1RM</small><strong>104.2 <em>kg</em></strong><span>自己ベスト更新</span>
        </div>
        <div className="chart-title"><strong>成長推移</strong><small>12週間</small></div>
        <div className="mini-chart"><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="history-list">
          <small>最近の記録</small>
          <div><b>8月8日</b><span>90 kg × 6</span></div>
          <div><b>8月3日</b><span>87.5 kg × 7</span></div>
          <div><b>7月28日</b><span>87.5 kg × 6</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="phone phone--back" aria-label="SmithNoteの分析画面イメージ">
      <div className="phone-bar"><span>9:41</span><i /></div>
      <div className="phone-head"><span>‹</span><strong>分析</strong><span>•••</span></div>
      <div className="period-tabs"><b>4週間</b><span>12週間</span><span>すべて</span></div>
      <div className="analysis-card">
        <small>今週のボリューム</small><strong>18,420 <em>kg</em></strong><span>先週比 +8.4%</span>
      </div>
      <div className="bars">{[42, 65, 51, 78, 63, 88, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
      <div className="parts"><small>部位バランス</small><div><i /><b>胸</b><span>32%</span></div><div><i /><b>背中</b><span>28%</span></div><div><i /><b>脚</b><span>24%</span></div></div>
    </div>
  );
}

function LandingPage() {
  return (
    <>
      <header className="site-header">
        <Brand />
        <nav aria-label="メインナビゲーション">
          <a href="#features">できること</a>
          <a href="#screens">画面</a>
          <a className="header-cta" href={`${import.meta.env.BASE_URL}app/`}>アプリを使う</a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> TRAIN. TRACK. GROW.</p>
            <h1>記録が、<br /><em>成長の証</em>に<br />なる。</h1>
            <p className="hero-lead">SmithNoteは、積み重ねたトレーニングを<br className="desktop-break" />次の一回につなげる筋トレ管理アプリです。</p>
            <StoreButtons />
            <p className="platform-note">iPhone対応 · Android版も開発中</p>
          </div>
          <div className="hero-visual" id="screens">
            <div className="visual-glow" />
            <PhoneMockup variant="analysis" />
            <PhoneMockup variant="history" />
            <div className="best-badge"><small>NEW BEST</small><strong>+2.5 kg</strong></div>
          </div>
        </section>

        <section className="statement">
          <p>昨日の自分を、今日の数字で超えていく。</p>
          <h2>なんとなく続けるトレーニングから、<br />成長が見えるトレーニングへ。</h2>
        </section>

        <section className="features" id="features">
          <div className="section-heading"><p>WHAT YOU CAN DO</p><h2>積み重ねを、<br />確かな手応えに。</h2></div>
          <div className="feature-grid">
            {features.map(([number, title, body]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>
            ))}
          </div>
        </section>

        <section className="details">
          <div><p className="eyebrow"><span /> BUILT FOR TRAINING</p><h2>トレーニング中も、<br />迷わず記録。</h2><p>よく使うメニューはプリセットに。種目、セット、重量、回数を素早く入力できるから、集中を途切れさせません。</p></div>
          <ul>
            <li><b>01</b><span><strong>ローカルファースト</strong>記録は端末内に保存。ログインなしですぐ始められます。</span></li>
            <li><b>02</b><span><strong>自分仕様の種目管理</strong>部位や器具に合わせて、種目とメニューを自由に整理できます。</span></li>
            <li><b>03</b><span><strong>安心のバックアップ</strong>必要なときだけクラウドへ保存。JSONでの書き出しにも対応します。</span></li>
          </ul>
        </section>

        <section className="download" id="download">
          <div className="download-mark">S</div>
          <p>YOUR NEXT REP STARTS HERE.</p>
          <h2>次の成長を、<br />記録しよう。</h2>
          <StoreButtons compact />
        </section>
      </main>
      <footer>
        <Brand />
        <div className="footer-links"><a href="#/privacy">プライバシーポリシー</a><a href="#/terms">利用規約</a>{landingConfig.contactEmail && <a href={`mailto:${landingConfig.contactEmail}`}>お問い合わせ</a>}</div>
        <small>© 2026 SmithNote</small>
      </footer>
    </>
  );
}

function LegalPage({ title, lead, sections }: { title: string; lead: string; sections: LegalSection[] }) {
  return (
    <div className="legal-shell">
      <header className="site-header"><Brand /><a className="back-link" href="#/">トップへ戻る</a></header>
      <main className="legal-page">
        <p className="eyebrow"><span /> SMITHNOTE</p>
        <h1>{title}</h1>
        <p className="legal-lead">{lead}</p>
        <p className="updated">最終更新日：{landingConfig.updatedAt}</p>
        <div className="legal-content">{sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</div>
        {landingConfig.contactEmail ? <p className="legal-contact">お問い合わせ：<a href={`mailto:${landingConfig.contactEmail}`}>{landingConfig.contactEmail}</a></p> : <p className="legal-contact">お問い合わせ先は、App Storeのサポートページに掲載します。</p>}
      </main>
    </div>
  );
}

export function LandingApp() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onHashChange = () => { setRoute(window.location.hash.slice(1) || '/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route === '/privacy') return <LegalPage title="プライバシーポリシー" lead="SmithNoteで扱う情報と、その利用方法について説明します。" sections={privacySections} />;
  if (route === '/terms') return <LegalPage title="利用規約" lead="SmithNoteを安心して利用するための基本的な条件です。" sections={termsSections} />;
  return <LandingPage />;
}
