'use client'

export const dynamic = 'force-dynamic'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import { Product, Profile, StorefrontMode } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

export default function CommercePage() {
  const supabase = useMemo(() => (typeof window === 'undefined' ? null : createClient()), [])
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<StorefrontMode>('headless')
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [newProduct, setNewProduct] = useState({ title: '', handle: '', price: '0', image: '' })

  const loadData = useCallback(async () => {
    if (!supabase) return
    const [{ data: productsData, error: productsErr }, modeRes] = await Promise.all([
      supabase.from('products').select('*').order('updated_at', { ascending: false }).limit(100),
      fetch('/api/commerce/settings'),
    ])
    if (productsErr) setError(productsErr.message)
    setProducts((productsData ?? []) as Product[])
    const modePayload = (await modeRes.json()) as { mode?: StorefrontMode }
    setMode(modePayload.mode === 'liquid' ? 'liquid' : 'headless')
  }, [supabase])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      setProfile((p as Profile) ?? null)
      await loadData()
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router, supabase, loadData])

  async function syncShopify() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/commerce/sync/shopify', { method: 'POST' })
    const data = (await res.json()) as { error?: string }
    if (!res.ok || data.error) setError(data.error ?? 'Sync failed')
    await loadData()
    setLoading(false)
  }

  async function updateMode(nextMode: StorefrontMode) {
    setMode(nextMode)
    await fetch('/api/commerce/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: nextMode }),
    })
  }

  async function createProduct(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const title = newProduct.title.trim()
    const handle = newProduct.handle.trim()
    if (!title || !handle) return
    const { error: insertErr } = await supabase.from('products').insert({
      source: 'manual',
      title,
      handle,
      body_html: '',
      status: 'active',
      price: Number(newProduct.price) || 0,
      inventory_qty: 0,
      featured_image_url: newProduct.image.trim() || null,
    })
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    setNewProduct({ title: '', handle: '', price: '0', image: '' })
    await loadData()
  }

  if (!ready) return <div className="layout layout-loading"><div className="main-content main-content-loading"><p>Loading commerce…</p></div></div>

  return (
    <div className="layout">
      <Sidebar
        user={profile ? { id: profile.id, full_name: profile.full_name, role: profile.role } : null}
        currentPath="/commerce"
      />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Commerce Manager</h1>
            <p className="page-subtitle">Shopify sync, mode selection, and product/media controls.</p>
          </div>
          <button className="btn-gold" type="button" onClick={syncShopify} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync Shopify'}
          </button>
        </header>
        <div className="page-body">
          {error ? <p className="form-error">{error}</p> : null}
          <section className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '.75rem' }}>Storefront Mode</h2>
              <div className="mode-switch-row">
                <button className={`btn-ghost ${mode === 'headless' ? 'active' : ''}`} onClick={() => updateMode('headless')}>Headless Next.js</button>
                <button className={`btn-ghost ${mode === 'liquid' ? 'active' : ''}`} onClick={() => updateMode('liquid')}>Shopify Liquid</button>
              </div>
            </div>
          </section>
          <section className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '.75rem' }}>Add Product + Photo</h2>
              <form className="three-col" onSubmit={createProduct}>
                <div className="form-group"><label className="form-label">Title</label><input value={newProduct.title} onChange={(e) => setNewProduct((p) => ({ ...p, title: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Handle</label><input value={newProduct.handle} onChange={(e) => setNewProduct((p) => ({ ...p, handle: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Price</label><input type="number" value={newProduct.price} onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Image URL</label><input value={newProduct.image} onChange={(e) => setNewProduct((p) => ({ ...p, image: e.target.value }))} /></div>
                <div style={{ gridColumn: '1 / -1' }}><button className="btn-gold" type="submit">Create Product</button></div>
              </form>
            </div>
          </section>
          <section className="card">
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '.75rem' }}>Catalog</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Title</th><th>Handle</th><th>Source</th><th>Status</th><th>Price</th></tr></thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id}>
                        <td>{p.title}</td><td>{p.handle}</td><td>{p.source}</td><td>{p.status}</td><td>${Number(p.price ?? 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
