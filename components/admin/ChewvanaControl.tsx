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
  X,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

const CHEWVANA_IMAGES = [
  "/images/chewvana/report-1.png",
  "/images/chewvana/report-2.png",
  "/images/chewvana/report-3.png",
  "/images/chewvana/report-4.png",
  "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1625401586060-f12be3d7cc57?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562077772-3bd90403f7f0?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1593766827228-8737b4534aa6?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512719994953-eabf50895df7?q=80&w=1200&auto=format&fit=crop",
];
function getRandomChewvanaImage(previousImage?: string) {
  const filtered = CHEWVANA_IMAGES.filter(img => img !== previousImage);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export default function ChewvanaControl({ adminPassword }: { adminPassword?: string }) {
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
    const newImage = getRandomChewvanaImage(lastUsedImage);
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
      editor_name: "Chewvana Desk",
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

  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-jcc-accent opacity-20" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-[var(--font-heading)] uppercase tracking-tight">Chewvana Times Archive</h2>
          <p className="text-[13px] text-white/50 font-medium uppercase tracking-widest mt-1">Editorial & Publication Control</p>
        </div>
        <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-3 w-full sm:w-auto">
          <div className="relative group w-full min-[420px]:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-jcc-accent transition-colors" />
            <input
              type="text"
              placeholder="Search reports..."
              className="pl-11 pr-4 py-3 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white uppercase tracking-widest w-full min-[420px]:w-48 sm:w-64 placeholder:text-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl btn-vibrant-blue text-black text-sm font-black transition-all uppercase tracking-widest shadow-lg w-full min-[420px]:w-auto shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            New Intel
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 rounded-2xl bg-jcc-ball-red/10 border border-jcc-ball-red/20 flex items-center gap-3 text-jcc-ball-red text-[13px] font-black uppercase tracking-widest"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <div key={article.id} className="premium-card p-4 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group w-full min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 flex-1 min-w-0 w-full">
                <div className="w-full sm:w-24 h-32 sm:h-24 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                  {article.cover_image_url ? (
                    <img src={article.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <Layout className="w-8 h-8 text-white/5" />
                  )}
                  <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg border ${article.status === 'published'
                    ? "bg-emerald-400 text-black border-emerald-400"
                    : "bg-white/10 text-white/40 border-white/10 backdrop-blur-md"
                    }`}>
                    {article.status}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2.5 py-1 rounded-lg bg-jcc-accent/10 border border-jcc-accent/20 text-[9px] font-black text-jcc-accent uppercase tracking-widest">
                      {article.category}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-white/30 font-black uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" /> {new Date(article.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-white mb-2 break-words whitespace-normal line-clamp-2 uppercase tracking-tight">{article.title}</h4>
                  <p className="text-[14px] text-white/70 font-medium line-clamp-1 italic">&quot;{article.excerpt || "No intelligence summary provided."}&quot;</p>
 
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-white/60">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                      <User className="w-3.5 h-3.5 text-jcc-accent" /> {article.reporter_alias || "The Chupa Captain"}
                    </div>
                    {article.match_date && (
                      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" /> {new Date(article.match_date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-white/20 font-black uppercase tracking-[0.2em] truncate min-w-0 max-w-[130px] min-[400px]:max-w-[200px] sm:max-w-none" title={`/${article.slug}`}>
                      /{article.slug}
                    </div>
                  </div>
                </div>
              </div>
 
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={`/chewvana-times/${article.slug}`}
                    target="_blank"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </a>
                  <button
                    onClick={() => handleTogglePublish(article)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 sm:px-4 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-lg ${article.status === 'published'
                      ? "bg-jcc-ball-red/10 border-jcc-ball-red/20 text-jcc-ball-red hover:bg-jcc-ball-red hover:text-black"
                      : "bg-emerald-400/10 border-emerald-400/20 text-emerald-400 hover:bg-emerald-400 hover:text-black"
                      }`}
                  >
                    {article.status === 'published' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {article.status === 'published' ? "Archive" : "Publish"}
                  </button>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleEdit(article)}
                    className="flex-1 sm:w-10 sm:h-10 sm:flex-initial rounded-xl bg-black/40 border border-white/10 text-white/60 hover:text-jcc-accent hover:bg-jcc-accent/10 transition-all flex items-center justify-center py-2.5 sm:py-0 shadow-lg gap-2 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="sm:hidden">Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="flex-1 sm:w-10 sm:h-10 sm:flex-initial rounded-xl bg-black/40 border border-white/10 text-white/60 hover:text-jcc-ball-red hover:bg-jcc-ball-red/10 transition-all flex items-center justify-center py-2.5 sm:py-0 shadow-lg gap-2 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="sm:hidden">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-24 text-center premium-card border-white/5">
            <Layout className="w-12 h-12 text-white/5 mx-auto mb-5" />
            <p className="text-white/40 font-black text-sm tracking-[0.3em] uppercase">No intelligence data detected</p>
            <p className="text-[11px] text-white/20 mt-2 uppercase tracking-widest">Initiate publication sequence to populate the archive.</p>
          </div>
        )}
      </div>

      {/* Article Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden premium-card border-white/20 shadow-[0_32px_128px_rgba(0,0,0,0.8)] bg-[#050E17] flex flex-col"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-jcc-accent/10 flex items-center justify-center border border-jcc-accent/20">
                    <Edit2 className="w-6 h-6 text-jcc-accent" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{editingArticle?.id ? "Modify intelligence" : "Construct Intel report"}</h3>
                    <p className="text-[10px] text-white/60 font-black uppercase tracking-[0.2em] mt-1">Dossier drafting sequence active</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseRequest}
                  disabled={isSubmitting}
                  className="w-12 h-12 rounded-full hover:bg-white/5 flex items-center justify-center transition-all group"
                >
                  <X className="w-7 h-7 text-white/40 group-hover:text-white" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-12">
                {/* Basic Info Section */}
                <div className="space-y-8">
                  <h4 className="text-[11px] font-black text-jcc-accent uppercase tracking-[0.3em] border-b border-white/5 pb-4">Primary Dossier Metrics</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] px-1">Codename / Headline *</label>
                        <input
                          type="text"
                          required
                          className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-white text-[16px] font-black shadow-inner"
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

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] px-1">Network Path (Slug) *</label>
                        <div className="relative group">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-black text-sm">/</span>
                          <input
                            type="text"
                            required
                            className="w-full pl-9 pr-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white uppercase tracking-widest shadow-inner"
                            placeholder="operation-midnight-strike"
                            value={editingArticle?.slug || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, slug: generateSlug(e.target.value) })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Classification</label>
                          <select
                            className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white uppercase tracking-widest shadow-inner appearance-none"
                            value={editingArticle?.category || "Match Report"}
                            onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                          >
                            <option className="bg-[#050E17]">Match Report</option>
                            <option className="bg-[#050E17]">Analysis</option>
                            <option className="bg-[#050E17]">Origin Story</option>
                            <option className="bg-[#050E17]">News</option>
                          </select>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Event Timestamp</label>
                          <input
                            type="date"
                            className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                            value={editingArticle?.match_date || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, match_date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Secondary Tagline</label>
                        <input
                          type="text"
                          className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white/60 shadow-inner"
                          placeholder="Brief tactical detail"
                          value={editingArticle?.subtitle || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, subtitle: e.target.value })}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Intelligence Abstract</label>
                        <textarea
                          rows={4}
                          className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white/60 shadow-inner resize-none placeholder:text-white/5"
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
                  <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.3em] border-b border-white/5 pb-4">Editorial Command</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Chief Editor</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        value={editingArticle?.editor_name || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, editor_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Field Operative (Alias)</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        placeholder="e.g. Ghost Willow"
                        value={editingArticle?.reporter_alias || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, reporter_alias: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Dossier Narrative Tone</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        value={editingArticle?.tone || "Sarcastic Investigative"}
                        onChange={(e) => setEditingArticle({ ...editingArticle, tone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Investigation Blocks */}
                <div className="space-y-8">
                  <h4 className="text-[11px] font-black text-jcc-ball-red uppercase tracking-[0.3em] border-b border-white/5 pb-4">Tactical Investigation Blocks</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">The Critical Query</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        placeholder="e.g. Was the wicket prepared or sabotaged?"
                        value={editingArticle?.key_question || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, key_question: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Tactical Brief (Sarcastic Summary)</label>
                      <textarea
                        rows={2}
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner resize-none"
                        placeholder="Brief overview of the fallout..."
                        value={editingArticle?.match_summary || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, match_summary: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Moment of Interest</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        placeholder="e.g. The dropped catch at slip."
                        value={editingArticle?.accused_moment || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, accused_moment: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Strategic Pivot</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        placeholder="When the tide shifted."
                        value={editingArticle?.turning_point || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, turning_point: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Primary Combatant (POTM)</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        placeholder="The lone survivor."
                        value={editingArticle?.player_of_the_match || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, player_of_the_match: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Final Prosecution Verdict</label>
                      <input
                        type="text"
                        className="w-full px-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                        placeholder="The absolute final word."
                        value={editingArticle?.closing_verdict || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, closing_verdict: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Media & Content Section */}
                <div className="space-y-8">
                  <h4 className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] border-b border-white/5 pb-4">Full Narrative Documentation</h4>
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Visual Evidence (Cover Image URL)</label>
                      <div className="flex gap-6">
                        <div className="relative flex-1 group">
                          <ImageIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/10 group-focus-within:text-jcc-accent transition-colors" />
                          <input
                            type="text"
                            className="w-full pl-14 pr-5 py-4 rounded-xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-sm font-black text-white shadow-inner"
                            placeholder="https://images.unsplash.com/..."
                            value={editingArticle?.cover_image_url || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, cover_image_url: e.target.value })}
                          />
                        </div>
                        {editingArticle?.cover_image_url && (
                          <div className="w-24 h-14 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                            <img src={editingArticle.cover_image_url} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Dossier Content (Markdown Standard) *</label>
                        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest flex items-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5" /> MD Protocol Active
                        </span>
                      </div>
                      <textarea
                        required
                        rows={15}
                        className="w-full px-6 py-6 rounded-2xl bg-black/40 border border-white/10 focus:border-jcc-accent outline-none transition-all text-[16px] font-medium leading-relaxed text-white/80 font-mono shadow-inner"
                        placeholder="Commence narrative sequence here..."
                        value={editingArticle?.content || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </form>

              <div className="p-8 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-8">
                  <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setEditingArticle({ ...editingArticle, status: 'draft' })}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${editingArticle?.status === 'draft' ? 'border-jcc-accent bg-jcc-accent' : 'border-white/10'}`}>
                      {editingArticle?.status === 'draft' && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                    <label className={`text-xs font-black uppercase tracking-widest cursor-pointer transition-colors ${editingArticle?.status === 'draft' ? 'text-jcc-accent' : 'text-white/20'}`}>Draft Status</label>
                  </div>
                  <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setEditingArticle({ ...editingArticle, status: 'published' })}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${editingArticle?.status === 'published' ? 'border-emerald-400 bg-emerald-400' : 'border-white/10'}`}>
                      {editingArticle?.status === 'published' && <div className="w-2 h-2 rounded-full bg-black" />}
                    </div>
                    <label className={`text-xs font-black uppercase tracking-widest cursor-pointer transition-colors ${editingArticle?.status === 'published' ? 'text-emerald-400' : 'text-white/20'}`}>Live Deployment</label>
                  </div>
                </div>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleCloseRequest}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-8 py-4 rounded-xl text-xs font-black text-white/30 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Abort Changes
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-10 py-4 rounded-xl btn-vibrant-blue text-black text-sm font-black transition-all uppercase tracking-widest shadow-xl disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {editingArticle?.id ? "Update Intel" : "Authorize Report"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
