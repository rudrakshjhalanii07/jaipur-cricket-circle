"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Loader2, Search, ArrowRight } from "lucide-react";

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

  useEffect(() => {
    if (isOpen) {
      fetchVenues();
    }
  }, [isOpen]);

  const fetchVenues = async () => {
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
      
      data?.forEach((v: any) => {
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
  };

  const filteredVenues = venues.filter(v => 
    v.location_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-jcc-navy/40 backdrop-blur-sm z-[999]"
          />

          <div className="fixed inset-0 flex items-center justify-center p-4 z-[1000] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] border border-jcc-border shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto"
            >
              <div className="p-8 bg-jcc-bg border-b border-jcc-border relative">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-jcc-border flex items-center justify-center shadow-sm">
                    <MapPin className="w-8 h-8 text-jcc-gold" />
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-white transition-colors"
                  >
                    <X className="w-5 h-5 text-jcc-muted" />
                  </button>
                </div>
                <h3 className="text-xl font-bold text-jcc-navy mb-2">Past Venues</h3>
                <p className="text-[14px] text-jcc-muted font-medium mb-6">
                  Reuse venue details from previous Sunday matches.
                </p>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-jcc-muted" />
                  <input
                    type="text"
                    placeholder="Search past venues..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white border border-jcc-border focus:border-jcc-blue outline-none transition-all text-sm font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {loading ? (
                  <div className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-jcc-blue opacity-20" />
                  </div>
                ) : filteredVenues.length > 0 ? (
                  <div className="grid gap-3">
                    {filteredVenues.map((v, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          onSelect({ name: v.location_name, url: v.location_map_url });
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-jcc-border hover:border-jcc-turf hover:bg-jcc-turf/[0.02] transition-all group text-left"
                      >
                        <div>
                          <p className="font-bold text-jcc-navy group-hover:text-jcc-turf transition-colors">{v.location_name}</p>
                          <p className="text-[11px] text-jcc-muted font-medium mt-1 uppercase tracking-widest">
                            Last used: {new Date(v.match_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-jcc-bg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="w-4 h-4 text-jcc-turf" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <MapPin className="w-10 h-10 text-jcc-muted mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-bold text-jcc-muted">No past venues found.</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-jcc-border bg-jcc-bg/50">
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-2xl bg-white border border-jcc-border text-jcc-muted font-bold text-sm hover:text-jcc-navy transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
