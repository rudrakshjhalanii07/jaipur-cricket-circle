"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  Image as ImageIcon,
  Layout,
  ExternalLink,
  Save,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import AdminEmptyState from "@/components/admin/AdminEmptyState";
import AdminModal, { AdminModalHeader } from "@/components/admin/AdminModal";

interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  cover_image_url?: string;
  category: string;
  match_date?: string;
  author: string;
  status: 'draft' | 'published';
  content: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  editor_name?: string;
  reporter_alias?: string;
  tone?: string;
  match_summary?: string;
  key_question?: string;
  accused_moment?: string;
  player_of_the_match?: string;
  turning_point?: string;
  closing_verdict?: string;
}

const BOUNDARY_BANTER_IMAGES = [
  "/images/boundary-banter/report-1.png",
  "/images/boundary-banter/report-2.png",
  "/images/boundary-banter/report-3.png",
  "/images/boundary-banter/report-4.png",
  "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1625401586060-f12be3d7cc57?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562077772-3bd90403f7f0?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1593766827228-8737b4534aa6?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512719994953-eabf50895df7?q=80&w=1200&auto=format&fit=crop",
];
function getRandomBoundaryBanterImage(previousImage?: string) {
  const filtered = BOUNDARY_BANTER_IMAGES.filter(img => img !== previousImage);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export default function BoundaryBanterControl({ adminPassword }: { adminPassword?: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastUsedImage, setLastUsedImage] = useState<string>("");

  async function fetchArticles() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/articles", {
        headers: { "x-admin-password": adminPassword || "" }
      });
      if (!response.ok) throw new Error("Failed to fetch articles");
      const data = await response.json();
      setArticles(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArticles();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseRequest = () => {
    if (isSubmitting) return;

    const hasData = editingArticle?.title || editingArticle?.content || editingArticle?.excerpt;
    if (hasData) {
      if (confirm("Discard draft changes? Your intelligence report data will be lost.")) {
        setIsModalOpen(false);
        setEditingArticle(null);
      }
    } else {
      setIsModalOpen(false);
      setEditingArticle(null);
    }
  };

  const handleCreate = () => {
    const newImage = getRandomBoundaryBanterImage(lastUsedImage);
    setLastUsedImage(newImage);

    setEditingArticle({
      title: "",
      slug: "",
      subtitle: "",
      excerpt: "",
      category: "Match Report",
      author: "Jaipur Cricket Circle",
      content: "",
      status: "draft",
      cover_image_url: newImage,
      match_date: new Date().toISOString().split('T')[0],
      editor_name: "Boundary Desk",
      reporter_alias: "",
      tone: "Sarcastic Investigative",
      match_summary: "",
      key_question: "",
      accused_moment: "",
      player_of_the_match: "",
      turning_point: "",
      closing_verdict: ""
    });
    setIsModalOpen(true);
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article? This action cannot be undone.")) return;

    try {
      const response = await fetch("/api/admin/articles/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || ""
        },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error("Failed to delete article");
      setArticles(articles.filter(a => a.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete article");
    }
  };

  const handleTogglePublish = async (article: Article) => {
    const isCurrentlyPublished = article.status === 'published';
    const nextStatus = isCurrentlyPublished ? 'draft' : 'published';

    try {
      const response = await fetch("/api/admin/articles/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || ""
        },
        body: JSON.stringify({ id: article.id, status: nextStatus })
      });

      if (!response.ok) throw new Error("Failed to update status");

      const result = await response.json();
      if (result.success) {
        // Update local state with the new status
        setArticles(articles.map(a => a.id === article.id ? { ...a, status: nextStatus } : a));
      }
    } catch (err: unknown) {
      alert("Error updating status: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle?.title || !editingArticle?.slug || !editingArticle?.content) {
      alert("Please fill in all required fields (Title, Slug, Content)");
      return;
    }

    setIsSubmitting(true);
    try {
      const isNew = !editingArticle.id;
      const url = isNew ? "/api/admin/articles/create" : "/api/admin/articles/update";

      // Add default cover image if empty
      const finalArticle = {
        ...editingArticle,
        cover_image_url: editingArticle.cover_image_url || "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1200&auto=format&fit=crop"
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword || ""
        },
        body: JSON.stringify(finalArticle)
      });

      if (!response.ok) {
        const res = await response.json();
        throw new Error(res.error || "Failed to save article");
      }

      const { data } = await response.json();
      if (isNew) {
        setArticles([data, ...articles]);
      } else {
        setArticles(articles.map(a => a.id === data.id ? data : a));
      }
      setIsModalOpen(false);
      setEditingArticle(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Boundary Banter Archive"
        subtitle="Editorial & Publication Control"
        toolbar={
          <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-3 w-full sm:w-auto sm:ml-auto">
            <div className="admin-search-wrap w-full min-[420px]:w-48 sm:w-64">
              <Search className="admin-search-icon w-4 h-4" />
              <input
                type="text"
                placeholder="Search reports, category..."
                className="admin-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl btn-vibrant-blue text-sm font-black transition-all uppercase tracking-widest shadow-lg w-full min-[420px]:w-auto shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              New Intel
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 rounded-2xl bg-jcc-danger/8 border border-jcc-danger/20 flex items-center gap-3 text-jcc-danger text-[13px] font-black uppercase tracking-widest"
          >
            <AlertCircle className="w-5 h-5" strokeWidth={1.5} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <AdminSkeleton rows={3} rowHeight="128px" />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredArticles.length > 0 ? (
            filteredArticles.map((article, index) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                className="premium-card p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group w-full min-w-0 overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 flex-1 min-w-0 w-full">
                  <div className="w-full sm:w-24 h-32 sm:h-24 rounded-2xl bg-jcc-navy-light border border-jcc-border-bright flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                    {article.cover_image_url ? (
                      <img src={article.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <Layout className="w-8 h-8 text-jcc-text-muted opacity-30" strokeWidth={1.5} />
                    )}
                    <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg border ${article.status === 'published'
                      ? "bg-jcc-accent text-jcc-blue border-jcc-accent"
                      : "bg-jcc-navy-light text-jcc-text-muted border-jcc-border-bright backdrop-blur-md"
                      }`}>
                      {article.status}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2.5 py-1 rounded-lg bg-jcc-accent/10 border border-jcc-accent/20 text-[9px] font-black text-jcc-accent-dark uppercase tracking-widest">
                        {article.category}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-jcc-text-muted font-black uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5" strokeWidth={1.5} /> {new Date(article.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-jcc-blue mb-2 break-words whitespace-normal line-clamp-2 uppercase tracking-tight">{article.title}</h4>
                    <p className="text-[14px] text-jcc-text-muted font-medium line-clamp-1 italic">&quot;{article.excerpt || "No intelligence summary provided."}&quot;</p>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-jcc-text-muted">
                        <User className="w-3.5 h-3.5 text-jcc-accent-dark" strokeWidth={1.5} /> {article.reporter_alias || "The Chupa Captain"}
                      </div>
                      {article.match_date && (
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-jcc-text-muted">
                          <Calendar className="w-3.5 h-3.5 text-jcc-accent-dark" strokeWidth={1.5} /> {new Date(article.match_date).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-jcc-text-muted font-black uppercase tracking-[0.2em] truncate min-w-0 max-w-[130px] min-[400px]:max-w-[200px] sm:max-w-none opacity-60" title={`/${article.slug}`}>
                        /{article.slug}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-jcc-border pt-4 md:pt-0">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={`/boundary-banter/${article.slug}`}
                      target="_blank"
                      className="btn-ghost flex-1 px-3! py-2.5! sm:px-4! text-[10px]!"
                    >
                      <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Preview
                    </a>
                    <button
                      onClick={() => handleTogglePublish(article)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-lg ${article.status === 'published'
                        ? "bg-jcc-danger/10 border-jcc-danger/25 text-jcc-danger hover:bg-jcc-danger hover:text-white"
                        : "bg-jcc-accent/10 border-jcc-accent/25 text-jcc-accent-dark hover:bg-jcc-accent hover:text-jcc-blue"
                        }`}
                    >
                      {article.status === 'published' ? <XCircle className="w-3.5 h-3.5" strokeWidth={1.5} /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      {article.status === 'published' ? "Archive" : "Publish"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleEdit(article)}
                      className="admin-btn-secondary flex-1 sm:w-10 sm:h-10 sm:flex-initial px-0! py-2.5! sm:py-0! gap-2 text-[10px]!"
                    >
                      <Edit2 className="w-4 h-4" strokeWidth={1.5} />
                      <span className="sm:hidden">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="admin-btn-destructive flex-1 sm:w-10 sm:h-10 sm:flex-initial px-0! py-2.5! sm:py-0! gap-2 text-[10px]!"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      <span className="sm:hidden">Delete</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="premium-card">
              <AdminEmptyState
                icon={Layout}
                title="No intelligence data detected"
                description="Initiate publication sequence to populate the archive."
              />
            </div>
          )}
        </div>
      )}

      {/* Article Editor Modal */}
      <AdminModal isOpen={isModalOpen} onClose={handleCloseRequest} maxWidth="max-w-5xl">
        {editingArticle && (
          <>
            <AdminModalHeader
              title={editingArticle?.id ? "Modify Intelligence" : "Construct Intel Report"}
              description="Dossier drafting sequence active"
              onClose={handleCloseRequest}
            />

            <form onSubmit={handleSubmit} className="overflow-y-auto p-8 sm:p-10 space-y-12">
              {/* Basic Info Section */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-jcc-accent-dark uppercase tracking-[0.3em] border-b border-jcc-border pb-4">Primary Dossier Metrics</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label className="admin-label">Codename / Headline *</label>
                      <input
                        type="text"
                        required
                        className="admin-input"
                        placeholder="e.g. Operation Midnight Strike"
                        value={editingArticle?.title || ""}
                        onChange={(e) => {
                          const title = e.target.value;
                          setEditingArticle({
                            ...editingArticle,
                            title,
                            slug: editingArticle?.id ? editingArticle.slug : generateSlug(title)
                          });
                        }}
                      />
                    </div>

                    <div>
                      <label className="admin-label">Network Path (Slug) *</label>
                      <div className="relative group">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-jcc-text-muted font-black text-sm pointer-events-none">/</span>
                        <input
                          type="text"
                          required
                          className="admin-input"
                          style={{ paddingLeft: 34 }}
                          placeholder="operation-midnight-strike"
                          value={editingArticle?.slug || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, slug: generateSlug(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="admin-label">Classification</label>
                        <select
                          className="admin-select"
                          value={editingArticle?.category || "Match Report"}
                          onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                        >
                          <option>Match Report</option>
                          <option>Analysis</option>
                          <option>Origin Story</option>
                          <option>News</option>
                        </select>
                      </div>
                      <div>
                        <label className="admin-label">Event Timestamp</label>
                        <input
                          type="date"
                          className="admin-input"
                          value={editingArticle?.match_date || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, match_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="admin-label">Secondary Tagline</label>
                      <input
                        type="text"
                        className="admin-input"
                        placeholder="Brief tactical detail"
                        value={editingArticle?.subtitle || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, subtitle: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="admin-label">Intelligence Abstract</label>
                      <textarea
                        rows={4}
                        className="admin-textarea"
                        placeholder="Executive summary of the investigation..."
                        value={editingArticle?.excerpt || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Editorial Info */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-jcc-accent-dark uppercase tracking-[0.3em] border-b border-jcc-border pb-4">Editorial Command</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <label className="admin-label">Chief Editor</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={editingArticle?.editor_name || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, editor_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Field Operative (Alias)</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="e.g. Ghost Willow"
                      value={editingArticle?.reporter_alias || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, reporter_alias: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Dossier Narrative Tone</label>
                    <input
                      type="text"
                      className="admin-input"
                      value={editingArticle?.tone || "Sarcastic Investigative"}
                      onChange={(e) => setEditingArticle({ ...editingArticle, tone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Investigation Blocks */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-jcc-danger uppercase tracking-[0.3em] border-b border-jcc-border pb-4">Tactical Investigation Blocks</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div>
                    <label className="admin-label">The Critical Query</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="e.g. Was the wicket prepared or sabotaged?"
                      value={editingArticle?.key_question || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, key_question: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Tactical Brief (Sarcastic Summary)</label>
                    <textarea
                      rows={2}
                      className="admin-textarea"
                      placeholder="Brief overview of the fallout..."
                      value={editingArticle?.match_summary || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, match_summary: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Moment of Interest</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="e.g. The dropped catch at slip."
                      value={editingArticle?.accused_moment || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, accused_moment: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Strategic Pivot</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="When the tide shifted."
                      value={editingArticle?.turning_point || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, turning_point: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Primary Combatant (POTM)</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="The lone survivor."
                      value={editingArticle?.player_of_the_match || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, player_of_the_match: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Final Prosecution Verdict</label>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="The absolute final word."
                      value={editingArticle?.closing_verdict || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, closing_verdict: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Media & Content Section */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-jcc-accent-dark uppercase tracking-[0.3em] border-b border-jcc-border pb-4">Full Narrative Documentation</h4>
                <div className="space-y-8">
                  <div>
                    <label className="admin-label">Visual Evidence (Cover Image URL)</label>
                    <div className="flex gap-6">
                      <div className="relative flex-1 group">
                        <ImageIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-jcc-blue opacity-35 group-focus-within:opacity-100 group-focus-within:text-jcc-accent transition-colors" />
                        <input
                          type="text"
                          className="admin-input"
                          style={{ paddingLeft: 52 }}
                          placeholder="https://images.unsplash.com/..."
                          value={editingArticle?.cover_image_url || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, cover_image_url: e.target.value })}
                        />
                      </div>
                      {editingArticle?.cover_image_url && (
                        <div className="w-24 h-14 rounded-xl overflow-hidden border border-jcc-border shadow-lg shrink-0">
                          <img src={editingArticle.cover_image_url} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="admin-label mb-0">Dossier Content (Markdown Standard) *</label>
                      <span className="text-[9px] text-jcc-text-muted font-black uppercase tracking-widest flex items-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5" /> MD Protocol Active
                      </span>
                    </div>
                    <textarea
                      required
                      rows={15}
                      className="admin-textarea font-mono"
                      placeholder="Commence narrative sequence here..."
                      value={editingArticle?.content || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </form>

            <div className="p-8 border-t border-jcc-border bg-jcc-navy-light/60 flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setEditingArticle({ ...editingArticle, status: 'draft' })}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${editingArticle?.status === 'draft' ? 'border-jcc-accent bg-jcc-accent' : 'border-jcc-border'}`}>
                    {editingArticle?.status === 'draft' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <label className={`text-xs font-black uppercase tracking-widest cursor-pointer transition-colors ${editingArticle?.status === 'draft' ? 'text-jcc-accent-dark' : 'text-jcc-text-muted'}`}>Draft Status</label>
                </div>
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setEditingArticle({ ...editingArticle, status: 'published' })}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${editingArticle?.status === 'published' ? 'border-jcc-accent bg-jcc-accent' : 'border-jcc-border'}`}>
                    {editingArticle?.status === 'published' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <label className={`text-xs font-black uppercase tracking-widest cursor-pointer transition-colors ${editingArticle?.status === 'published' ? 'text-jcc-accent-dark' : 'text-jcc-text-muted'}`}>Live Deployment</label>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCloseRequest}
                  disabled={isSubmitting}
                  className="admin-btn-secondary flex-1 sm:flex-none"
                >
                  Abort Changes
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-xl btn-vibrant-blue text-sm font-black transition-all uppercase tracking-widest shadow-xl disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {editingArticle?.id ? "Update Intel" : "Authorize Report"}
                </button>
              </div>
            </div>
          </>
        )}
      </AdminModal>
    </div>
  );
}
