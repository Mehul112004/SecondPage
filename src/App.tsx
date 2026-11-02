import './App.css'

function App() {
  return (
    <main>
      <header><a href="/" className="brand">SecondPage<span>↗</span></a><span className="badge">PAPER TRADING</span></header>
      <section>
        <p className="eyebrow">YOUR NEXT TRADE STARTS HERE</p>
        <h1>Practice the market.<br /><span>Build your edge.</span></h1>
        <p className="intro">A workspace for paper trading Indian stocks and options. Learn, test strategies, and track your progress with virtual capital.</p>
        <div className="status"><span /> Your trading workspace is taking shape</div>
      </section>
      <div className="features">
        <article><p>01 / EXPLORE</p><h2>Indian markets</h2><span>A foundation for equities and index options.</span></article>
        <article><p>02 / PRACTICE</p><h2>Virtual capital</h2><span>Develop your process through simulated trades.</span></article>
        <article><p>03 / REFLECT</p><h2>Trading journal</h2><span>A place to understand decisions and performance.</span></article>
      </div>
      <footer>SecondPage · Project foundation<span>Simulation only · No live market connection</span></footer>
    </main>
  )
}

export default App
