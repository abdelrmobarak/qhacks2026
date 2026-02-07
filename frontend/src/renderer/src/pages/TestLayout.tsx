import MainLayout from '../components/layout/MainLayout'

export default function TestLayout() {
  return (
    <MainLayout>
      <div>
        <h1 style={{ fontSize: '2rem', color: '#0B1B2B' }}>MainLayout Test</h1>
        <p>If you see this, MainLayout is working!</p>
      </div>
    </MainLayout>
  )
}
