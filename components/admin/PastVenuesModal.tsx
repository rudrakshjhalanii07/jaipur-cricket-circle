"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MapPin, X, Search, ArrowRight } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";
import AdminSkeleton from "@/components/admin/AdminSkeleton";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

interface Venue {
  location_name: string;
  location_map_url: string;
  match_date: string;
}

interface PastVenuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (venue: { name: string; url: string }) => void;
}

export default function PastVenuesModal({ isOpen, onClose, onSelect }: PastVenuesModalProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function fetchVenues() {
    setLoading(true);
    try {
      // Select distinct venue names and their latest URLs/dates
      const { data, error } = await supabase
        .from("matches")
        .select("location_name, location_map_url, match_date")
        .order("match_date", { ascending: false });

      if (error) throw error;

      // Filter for unique venue names
      const uniqueVenues: Venue[] = [];
      const seenNames = new Set();

      (data as Venue[])?.forEach((v) => {
        if (!seenNames.has(v.location_name)) {
          seenNames.add(v.location_name);
          uniqueVenues.push(v);
        }
      });

      setVenues(uniqueVenues);
    } catch (err) {
      console.error("Error fetching venues:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        fetchVenues();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredVenues = venues.filter(v =>
    v.location_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-8 bg-jcc-navy-light border-b border-jcc-border-bright shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white border border-jcc-border-bright flex items-center justify-center shadow-inner">
            <MapPin className="w-8 h-8 text-jcc-accent-dark" strokeWidth={1.5} />
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-jcc-accent/10 transition-colors">
            <X className="w-5 h-5 text-jcc-text-muted" strokeWidth={1.5} />
          </button>
        </div>
        <h3 className="text-xl font-black text-jcc-blue uppercase tracking-tight mb-2">Past Venues</h3>
        <p className="text-[14px] text-jcc-text-muted font-medium mb-6">
          Reuse venue details from previous matches.
        </p>

        <div className="admin-search-wrap">
          <Search className="admin-search-icon w-4 h-4" />
          <input
            type="text"
            placeholder="Search past venues..."
            className="admin-search"
            style={{ height: 52 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4 overflow-y-auto">
        {loading ? (
          <AdminSkeleton rows={4} rowHeight="64px" />
        ) : filteredVenues.length > 0 ? (
          <div className="grid gap-3">
            {filteredVenues.map((v, i) => (
              <button
                key={i}
                onClick={() => {
                  onSelect({ name: v.location_name, url: v.location_map_url });
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-jcc-navy-light border border-jcc-border-bright hover:border-jcc-accent hover:bg-jcc-accent/5 transition-all group text-left"
              >
                <div>
                  <p className="font-bold text-jcc-blue group-hover:text-jcc-accent-dark transition-colors">{v.location_name}</p>
                  <p className="text-[11px] text-jcc-text-muted font-medium mt-1 uppercase tracking-widest">
                    Last used: {new Date(v.match_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-jcc-blue flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-4 h-4 text-jcc-accent" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <AdminEmptyState icon={MapPin} title="No past venues found" description="Venues used in previous matches will appear here." />
        )}
      </div>

      <div className="p-4 border-t border-jcc-border-bright shrink-0">
        <button onClick={onClose} className="admin-btn-secondary w-full">
          Close
        </button>
      </div>
    </AdminModal>
  );
}
