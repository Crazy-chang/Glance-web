import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import MarketOverview from './pages/MarketOverview'
import RSSReader from './pages/RSSReader'
import WebLinks from './pages/WebLinks'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<MarketOverview />} />
        <Route path="/rss" element={<RSSReader />} />
        <Route path="/links" element={<WebLinks />} />
      </Route>
    </Routes>
  )
}

export default App
