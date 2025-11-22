
import React, { useState, useEffect } from "react";
import { MorphGuide } from "@/entities/MorphGuide";
import { User } from "@/entities/User"; // Added: Import User entity
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  BookOpen,
  Info,
  Filter,
  Grid3X3,
  List
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import _ from 'lodash';

import MorphCard from "../components/morph-guide/MorphCard";
import MorphDetail from "../components/morph-guide/MorphDetail";

const rarityColors = {
  common: "bg-amber-100 text-amber-700 border-amber-200",
  uncommon: "bg-yellow-200 text-yellow-800 border-yellow-300",
  rare: "bg-orange-200 text-orange-800 border-orange-300",
  very_rare: "bg-yellow-400 text-yellow-900 border-yellow-500"
};

export default function MorphGuidePage() {
  const [morphs, setMorphs] = useState([]);
  const [filteredMorphs, setFilteredMorphs] = useState([]);
  const [selectedMorph, setSelectedMorph] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("rarity_rare_first"); // Changed: Default to rarest first
  const [viewMode, setViewMode] = useState("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null); // Added: User state

  const loadMorphs = async () => {
    setIsLoading(true);
    try {
      // Modified: Fetch morphs and user data concurrently
      const [data, currentUser] = await Promise.all([
        MorphGuide.list(),
        User.me().catch(() => null) // Catch error if user not logged in, return null
      ]);

      const uniqueMorphs = _.uniqBy(data, (morph) =>
        morph.morph_name.toLowerCase().replace(/\s*\(.*\)\s*/, '').trim()
      );
      setMorphs(uniqueMorphs);
      setUser(currentUser); // Set user state

      // Added: Load user's preferred sort setting
      if (currentUser?.morph_guide_sort) {
        setSortBy(currentUser.morph_guide_sort);
      }
    } catch (error) {
      console.error("Error loading morph guide:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMorphs();
  }, []);

  // Added: Save user's sort preference when it changes
  useEffect(() => {
    const saveSortPreference = async () => {
      // Only save if user is logged in and the sort preference is not the default
      if (user && sortBy !== "rarity_rare_first") {
        try {
          await User.updateMyUserData({ morph_guide_sort: sortBy });
        } catch (error) {
          console.error("Failed to save sort preference:", error);
        }
      }
    };

    // Only attempt to save if user data has been loaded
    if (user) {
      saveSortPreference();
    }
  }, [sortBy, user]); // Dependencies: sortBy and user

  useEffect(() => {
    let newFiltered = [...morphs];

    // Search
    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        newFiltered = newFiltered.filter(img =>
            img.morph_name.toLowerCase().includes(lowercasedTerm) ||
            img.description?.toLowerCase().includes(lowercasedTerm) ||
            img.key_features?.some(feature => feature.toLowerCase().includes(lowercasedTerm))
        );
    }

    // Rarity filter
    if (rarityFilter !== 'all') {
      newFiltered = newFiltered.filter(img => img.rarity === rarityFilter);
    }

    // Sorting
    const rarityOrder = { common: 1, uncommon: 2, rare: 3, very_rare: 4 };
    const rarityOrderDesc = { very_rare: 1, rare: 2, uncommon: 3, common: 4 };
    newFiltered.sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical_desc':
          return b.morph_name.localeCompare(a.morph_name);
        case 'rarity_common_first':
          return (rarityOrder[a.rarity] || 5) - (rarityOrder[b.rarity] || 5) || a.morph_name.localeCompare(b.morph_name);
        case 'rarity_rare_first':
          return (rarityOrderDesc[a.rarity] || 5) - (rarityOrderDesc[b.rarity] || 5) || a.morph_name.localeCompare(b.morph_name);
        case "pattern_complexity":
          return (b.key_features?.length || 0) - (a.key_features?.length || 0) || a.morph_name.localeCompare(b.morph_name);
        case "breeding_difficulty":
          return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0) || a.morph_name.localeCompare(b.morph_name);
        case 'alphabetical':
        default:
          return a.morph_name.localeCompare(b.morph_name);
      }
    });

    setFilteredMorphs(newFiltered);
  }, [morphs, searchTerm, rarityFilter, sortBy]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 to-earth-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-sage-600 to-earth-600 rounded-xl flex items-center justify-center shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-sage-900">Crested Gecko Morph Guide</h1>
          </div>
          <p className="text-lg text-sage-600 max-w-3xl mx-auto">
            Comprehensive guide to crested gecko morphs, their characteristics, and breeding information.
            Learn to identify different patterns and traits to improve your classification accuracy.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8 bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sage-400" />
                <Input
                  placeholder="Search morphs, features, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-sage-300"
                />
              </div>

              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-sage-600" />
                  <Select value={rarityFilter} onValueChange={setRarityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Rarity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rarities</SelectItem>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="very_rare">Very Rare</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-sage-600">Sort by:</span>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alphabetical">A-Z</SelectItem>
                      <SelectItem value="alphabetical_desc">Z-A</SelectItem>
                      <SelectItem value="rarity_common_first">Rarity (Common First)</SelectItem>
                      <SelectItem value="rarity_rare_first">Rarity (Rare First)</SelectItem>
                      <SelectItem value="pattern_complexity">Pattern Complexity</SelectItem>
                      <SelectItem value="breeding_difficulty">Breeding Difficulty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex bg-sage-100 rounded-lg p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={viewMode === "grid" ? "bg-white shadow-sm" : ""}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={viewMode === "list" ? "bg-white shadow-sm" : ""}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-sage-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-sage-600">Total Morphs:</span>
                <Badge variant="outline">{morphs.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-sage-600">Showing:</span>
                <Badge variant="outline">{filteredMorphs.length}</Badge>
              </div>
              {Object.entries(
                morphs.reduce((acc, morph) => {
                  acc[morph.rarity] = (acc[morph.rarity] || 0) + 1;
                  return acc;
                }, {})
              ).map(([rarity, count]) => (
                <Badge key={rarity} className={rarityColors[rarity]}>
                  {rarity.replace('_', ' ')}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-sage-200 rounded"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-sage-200 rounded"></div>
                    <div className="h-4 bg-sage-200 rounded w-3/4"></div>
                    <div className="h-4 bg-sage-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredMorphs.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-sage-400" />
              </div>
              <h3 className="text-xl font-semibold text-sage-900 mb-2">No morphs found</h3>
              <p className="text-sage-600 mb-4">
                Try adjusting your search terms or filters to find what you're looking for.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setRarityFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMorphs.map((morph) => (
                  <MorphCard
                    key={morph.id}
                    morph={morph}
                    onClick={setSelectedMorph}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMorphs.map((morph) => (
                  <Card
                    key={morph.id}
                    className="bg-white/80 backdrop-blur-sm border-sage-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedMorph(morph)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-sage-900">{morph.morph_name}</h3>
                            <Badge className={rarityColors[morph.rarity]}>
                              {morph.rarity.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sage-700 mb-3 line-clamp-2">{morph.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {morph.key_features?.slice(0, 3).map((feature, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                            {morph.key_features?.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{morph.key_features.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Info className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Detail Modal/Sidebar */}
        {selectedMorph && (
          <MorphDetail
            morph={selectedMorph}
            onClose={() => setSelectedMorph(null)}
          />
        )}
      </div>
    </div>
  );
}
