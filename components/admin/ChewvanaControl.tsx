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
  Tag, 
  User, 
  ChevronRight,
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

export default function ChewvanaControl({ adminPassword }: { adminPassword?: string }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/articles", {
        headers: { "x-admin-password": adminPassword || "" }
      });
      if (!response.ok) throw new Error("Failed to fetch articles");
      const data = await response.json();
      setArticles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingArticle({
      title: "",
      slug: "",
      subtitle: "",
      excerpt: "",
      category: "Match Report",
      author: "Jaipur Cricket Circle",
      content: "",
      status: "draft",
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
    } catch (err: any) {
      alert(err.message);
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
    } catch (err: any) {
      alert("Error updating status: " + err.message);
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
    } catch (err: any) {
      alert(err.message);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-jcc-navy font-[var(--font-heading)]">Chewvana Times Archive</h2>
          <p className="text-[12px] text-jcc-muted font-medium">Manage match reports, analysis, and stories from the circle.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-muted" />
            <input
              type="text"
              placeholder="Search articles..."
              className="pl-10 pr-4 py-2.5 rounded-xl bg-white border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium w-full sm:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jcc-blue-deep text-white text-sm font-bold shadow-lg shadow-jcc-blue/20 hover:scale-[1.02] transition-all"
          >
            <Plus className="w-4 h-4" />
            New Article
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-jcc-red/[0.06] border border-jcc-red/15 flex items-center gap-3 text-jcc-red text-[13px] font-bold"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-jcc-blue" /></div>
        ) : filteredArticles.length > 0 ? (
          filteredArticles.map((article) => (
            <div key={article.id} className="glass-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:border-jcc-blue/20 transition-all duration-300">
              <div className="flex items-start gap-5 flex-1 min-w-0">
                <div className="w-20 h-20 rounded-2xl bg-jcc-bg border border-jcc-border flex items-center justify-center shrink-0 overflow-hidden relative">
                  {article.cover_image_url ? (
                    <img src={article.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Layout className="w-6 h-6 text-jcc-muted/30" />
                  )}
                  <div className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm border ${
                    article.status === 'published' 
                      ? "bg-jcc-turf text-white border-jcc-turf/20" 
                      : "bg-jcc-muted/20 text-jcc-muted border-jcc-muted/20"
                  }`}>
                    {article.status}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-md bg-jcc-blue/[0.06] border border-jcc-blue/10 text-[9px] font-bold text-jcc-blue uppercase tracking-widest">
                      {article.category}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-jcc-muted font-medium">
                      <Clock className="w-3 h-3" /> {new Date(article.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-[17px] font-bold text-jcc-navy mb-1 truncate">{article.title}</h4>
                  <p className="text-[13px] text-jcc-muted font-medium line-clamp-1">{article.excerpt || "No excerpt provided."}</p>
                  
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-jcc-muted font-semibold">
                      <User className="w-3.5 h-3.5 text-jcc-blue" /> {article.author}
                    </div>
                    {article.match_date && (
                      <div className="flex items-center gap-1.5 text-[11px] text-jcc-muted font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-jcc-turf" /> {new Date(article.match_date).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-[11px] text-jcc-muted font-semibold italic">
                      /{article.slug}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                <a 
                  href={`/chewvana-times/${article.slug}`} 
                  target="_blank" 
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-jcc-border text-jcc-muted hover:text-jcc-blue hover:border-jcc-blue/30 transition-all text-xs font-bold"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </a>
                <button 
                  onClick={() => handleTogglePublish(article)}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs font-bold ${
                    article.status === 'published'
                      ? "bg-jcc-red/[0.03] border-jcc-red/10 text-jcc-red hover:bg-jcc-red/5"
                      : "bg-jcc-turf/[0.03] border-jcc-turf/10 text-jcc-turf hover:bg-jcc-turf/5"
                  }`}
                >
                  {article.status === 'published' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {article.status === 'published' ? "Unpublish" : "Publish"}
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleEdit(article)}
                    className="p-2.5 rounded-xl bg-jcc-bg border border-jcc-border text-jcc-navy hover:bg-white hover:border-jcc-blue transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(article.id)}
                    className="p-2.5 rounded-xl bg-jcc-bg border border-jcc-border text-jcc-red hover:bg-jcc-red/5 hover:border-jcc-red transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center glass-card bg-jcc-bg/30">
            <Layout className="w-8 h-8 text-jcc-muted mx-auto mb-3 opacity-30" />
            <p className="text-jcc-muted font-bold text-sm tracking-wide uppercase">No Articles Found</p>
            <p className="text-[11px] text-jcc-muted mt-1">Start by creating your first match report or story.</p>
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
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="absolute inset-0 bg-jcc-navy/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden glass-card shadow-2xl bg-white flex flex-col"
            >
              <div className="p-6 border-b border-jcc-border flex items-center justify-between bg-jcc-bg/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-jcc-blue/10 flex items-center justify-center">
                    <Edit2 className="w-5 h-5 text-jcc-blue" />
                  </div>
                  <div>
                    <h3 className="font-bold text-jcc-navy">{editingArticle?.id ? "Edit Article" : "Create New Article"}</h3>
                    <p className="text-[11px] text-jcc-muted font-medium">Draft your next sports highlight</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-2 hover:bg-jcc-bg rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-jcc-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Basic Info Section */}
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-jcc-blue uppercase tracking-[0.2em] border-b border-jcc-blue/10 pb-2">Basic Publication Info</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Headline / Title *</label>
                        <input 
                          type="text"
                          required
                          className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-[15px] font-bold"
                          placeholder="e.g. The Day NeuroStrikers Claimed the Lead"
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

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Slug (URL Path) *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-jcc-muted/50 font-bold text-sm">/</span>
                          <input 
                            type="text"
                            required
                            className="w-full pl-7 pr-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                            placeholder="the-day-neurostrikers-claimed-the-lead"
                            value={editingArticle?.slug || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, slug: generateSlug(e.target.value) })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Category</label>
                          <select 
                            className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-bold"
                            value={editingArticle?.category || "Match Report"}
                            onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                          >
                            <option>Match Report</option>
                            <option>Analysis</option>
                            <option>Origin Story</option>
                            <option>News</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Match Date</label>
                          <input 
                            type="date"
                            className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-bold"
                            value={editingArticle?.match_date || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, match_date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Subtitle</label>
                        <input 
                          type="text"
                          className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                          placeholder="A short punchy line below the title"
                          value={editingArticle?.subtitle || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, subtitle: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Excerpt</label>
                        <textarea 
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium resize-none"
                          placeholder="Brief summary for the card preview..."
                          value={editingArticle?.excerpt || ""}
                          onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Editorial Info */}
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-jcc-purple uppercase tracking-[0.2em] border-b border-jcc-purple/10 pb-2">Editorial Staff</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Editor Name</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-bold"
                        value={editingArticle?.editor_name || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, editor_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Reporter Alias</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-bold"
                        placeholder="e.g. The Whispering Willow"
                        value={editingArticle?.reporter_alias || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, reporter_alias: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Tone</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-bold"
                        value={editingArticle?.tone || "Sarcastic Investigative"}
                        onChange={(e) => setEditingArticle({ ...editingArticle, tone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Investigation Blocks */}
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-jcc-turf uppercase tracking-[0.2em] border-b border-jcc-turf/10 pb-2">Investigation Blocks</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">The Central Question</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                        placeholder="e.g. Did the top order forget their bats or just their dignity?"
                        value={editingArticle?.key_question || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, key_question: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Match Summary (The Sarcastic Brief)</label>
                      <textarea 
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium resize-none"
                        placeholder="A quick summary of the chaos..."
                        value={editingArticle?.match_summary || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, match_summary: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Moment Under Investigation</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                        placeholder="e.g. The 14th over run-out comedy."
                        value={editingArticle?.accused_moment || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, accused_moment: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Turning Point</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                        placeholder="When it all went sideways."
                        value={editingArticle?.turning_point || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, turning_point: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Player of the Match</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                        placeholder="Who survived the mess?"
                        value={editingArticle?.player_of_the_match || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, player_of_the_match: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Final Verdict</label>
                      <input 
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                        placeholder="The brutal truth."
                        value={editingArticle?.closing_verdict || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, closing_verdict: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Media & Content Section */}
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-jcc-muted uppercase tracking-[0.2em] border-b border-jcc-border pb-2">Full Investigation Content</h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Cover Image URL</label>
                      <div className="flex gap-4">
                        <div className="relative flex-1">
                          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-muted/50" />
                          <input 
                            type="text"
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                            placeholder="https://images.unsplash.com/..."
                            value={editingArticle?.cover_image_url || ""}
                            onChange={(e) => setEditingArticle({ ...editingArticle, cover_image_url: e.target.value })}
                          />
                        </div>
                        {editingArticle?.cover_image_url && (
                          <div className="w-20 h-11 rounded-lg overflow-hidden border border-jcc-border">
                            <img src={editingArticle.cover_image_url} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-jcc-muted uppercase tracking-widest">Article Body (Markdown Supported) *</label>
                        <span className="text-[10px] text-jcc-muted font-bold flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Markdown Tips
                        </span>
                      </div>
                      <textarea 
                        required
                        rows={12}
                        className="w-full px-5 py-4 rounded-2xl bg-jcc-bg border border-jcc-border focus:border-jcc-blue outline-none transition-all text-[15px] font-medium leading-relaxed font-mono"
                        placeholder="Write your investigation here using Markdown..."
                        value={editingArticle?.content || ""}
                        onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </form>

              <div className="p-6 border-t border-jcc-border bg-jcc-bg/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      id="status-draft" 
                      name="status" 
                      checked={editingArticle?.status === 'draft'} 
                      onChange={() => setEditingArticle({ ...editingArticle, status: 'draft' })}
                      className="w-4 h-4 text-jcc-blue"
                    />
                    <label htmlFor="status-draft" className="text-xs font-bold text-jcc-muted">Draft</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      id="status-published" 
                      name="status" 
                      checked={editingArticle?.status === 'published'} 
                      onChange={() => setEditingArticle({ ...editingArticle, status: 'published' })}
                      className="w-4 h-4 text-jcc-turf"
                    />
                    <label htmlFor="status-published" className="text-xs font-bold text-jcc-turf">Published</label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-jcc-muted hover:text-jcc-navy transition-colors"
                  >
                    Discard Changes
                  </button>
                  <button 
                    type="submit"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-jcc-navy text-white text-sm font-bold shadow-xl shadow-jcc-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingArticle?.id ? "Update Publication" : "Create Publication"}
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
