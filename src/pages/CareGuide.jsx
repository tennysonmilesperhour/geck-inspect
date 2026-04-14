import { useState, useEffect } from 'react';
import { CareGuideSection } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  Home,
  Utensils,
  Hand,
  Users,
  Info,
  ExternalLink,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Thermometer,
  Droplets,
  Clock,
  Scale
} from 'lucide-react';
import Seo from '@/components/seo/Seo';

const CARE_GUIDE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': 'https://geckinspect.com/CareGuide#article',
      headline: 'Crested Gecko Care Guide — Complete Beginner to Advanced Reference',
      description:
        'Comprehensive care guide for crested geckos (Correlophus ciliatus): housing, temperature and humidity, diet, handling, common health issues, shedding, tail loss, breeding, and hatchling care.',
      url: 'https://geckinspect.com/CareGuide',
      about: {
        '@type': 'Thing',
        name: 'Crested gecko',
        alternateName: 'Correlophus ciliatus',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Geck Inspect',
        url: 'https://geckinspect.com/',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://geckinspect.com/CareGuide#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How big of an enclosure does a crested gecko need?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'An adult crested gecko needs a minimum of an 18x18x24 inch vertical terrarium. Hatchlings should start in a smaller 6-qt tub or 12x12x18 inch juvenile enclosure to reduce stress and make feeding easier to monitor. Vertical height matters more than floor space because crested geckos are arboreal.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do crested geckos need heat or UVB lighting?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Crested geckos thrive at room temperature (72-78°F) and usually do not need supplemental heat in most homes. They do not strictly require UVB lighting because complete crested gecko diets (CGD) contain vitamin D3, but low-level UVB is enriching and beneficial. Avoid temperatures above 82°F, which are stressful and potentially fatal.',
          },
        },
        {
          '@type': 'Question',
          name: 'What do crested geckos eat?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The primary diet is commercial Crested Gecko Diet (CGD) — a complete powdered food mixed with water. Popular brands include Pangea, Repashy, and Black Panther Zoological. Insects like dubia roaches or black soldier fly larvae can be offered 1-2 times per week as optional enrichment, but are not required. Fresh fruit should only be offered rarely as a treat.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long do crested geckos live?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'With proper care, crested geckos can live 15 to 20 years in captivity. They are a long-term commitment.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do crested geckos regrow their tails?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. Unlike leopard geckos and many other species, crested geckos do not regrow their tails once dropped. Tail loss (autotomy) is a predator-escape response and is permanent. Tailless crested geckos are extremely common in the hobby and live normal, healthy lives.',
          },
        },
        {
          '@type': 'Question',
          name: 'When can crested geckos be bred?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Females should not be bred until they reach 35-40 grams and at least 18 months of age to avoid calcium depletion and egg-binding. Males can breed earlier once they reach 25-30 grams of healthy weight. Never breed undersized or underage females.',
          },
        },
      ],
    },
  ],
};

const categoryIcons = {
  housing: <Home className="w-6 h-6" />,
  feeding: <Utensils className="w-6 h-6" />,
  handling: <Hand className="w-6 h-6" />,
  breeding: <Users className="w-6 h-6" />,
  health: <Heart className="w-6 h-6" />,
  general: <Info className="w-6 h-6" />,
};

const categoryDescriptions = {
  general: "Essential information for new gecko keepers and general care principles",
  housing: "Proper terrarium setup, lighting, heating, and environmental requirements",
  feeding: "Diet, feeding schedules, supplements, and nutrition guidelines",
  handling: "Safe handling techniques, behavior understanding, and bonding",
  health: "Health monitoring, common issues, veterinary care, and preventive measures",
  breeding: "Breeding requirements, egg care, incubation, and hatchling care"
};

const categoryColors = {
  general: "bg-blue-100 text-blue-800 border-blue-200",
  housing: "bg-green-100 text-green-800 border-green-200",
  feeding: "bg-orange-100 text-orange-800 border-orange-200",
  handling: "bg-purple-100 text-purple-800 border-purple-200",
  health: "bg-red-100 text-red-800 border-red-200",
  breeding: "bg-pink-100 text-pink-800 border-pink-200"
};

// Enhanced content renderer for better formatting
const ContentRenderer = ({ content, title: _title }) => {
  if (!content) return null;

  // Split content into sections and format
  const formatContent = (text) => {
    // Replace headers
    let formatted = text
      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold text-slate-100 mt-6 mb-3 flex items-center gap-2"><span class="w-1 h-6 bg-emerald-500 rounded"></span>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-slate-100 mt-8 mb-4 flex items-center gap-2"><span class="w-2 h-7 bg-emerald-500 rounded"></span>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-slate-100 mt-10 mb-5">$1</h1>');

    // Format lists
    formatted = formatted.replace(/^\* (.*$)/gm, '<li class="text-slate-300 mb-2 flex items-start gap-2"><span class="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></span><span>$1</span></li>');
    formatted = formatted.replace(/^- (.*$)/gm, '<li class="text-slate-300 mb-2 flex items-start gap-2"><span class="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></span><span>$1</span></li>');
    
    // Wrap consecutive list items
    formatted = formatted.replace(/(<li.*?<\/li>\s*)+/g, '<ul class="space-y-2 my-4 ml-2">$&</ul>');

    // Format important notes
    formatted = formatted.replace(/\*\*Important:\*\* (.*?)(?=\n|$)/g, '<div class="bg-yellow-900/30 border border-yellow-600/30 rounded-lg p-4 my-4 flex items-start gap-3"><div class="text-yellow-400 mt-1"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></div><div><p class="text-yellow-100 font-medium">Important</p><p class="text-yellow-200 text-sm mt-1">$1</p></div></div>');
    
    // Format tips
    formatted = formatted.replace(/\*\*Tip:\*\* (.*?)(?=\n|$)/g, '<div class="bg-green-900/30 border border-green-600/30 rounded-lg p-4 my-4 flex items-start gap-3"><div class="text-green-400 mt-1"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg></div><div><p class="text-green-100 font-medium">Tip</p><p class="text-green-200 text-sm mt-1">$1</p></div></div>');

    // Format warnings
    formatted = formatted.replace(/\*\*Warning:\*\* (.*?)(?=\n|$)/g, '<div class="bg-red-900/30 border border-red-600/30 rounded-lg p-4 my-4 flex items-start gap-3"><div class="text-red-400 mt-1"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg></div><div><p class="text-red-100 font-medium">Warning</p><p class="text-red-200 text-sm mt-1">$1</p></div></div>');

    // Format bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>');
    
    // Format italic text
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-slate-300">$1</em>');

    // Format paragraphs
    formatted = formatted.split('\n\n').map(paragraph => {
      if (paragraph.trim() && !paragraph.includes('<')) {
        return `<p class="text-slate-300 leading-relaxed mb-4">${paragraph.trim()}</p>`;
      }
      return paragraph;
    }).join('\n\n');

    return formatted;
  };

  return (
    <div 
      className="prose prose-invert max-w-none" 
      dangerouslySetInnerHTML={{ __html: formatContent(content) }}
    />
  );
};

const QuickFactsBox = ({ category }) => {
  const quickFacts = {
    housing: [
      { icon: <Scale className="w-4 h-4" />, label: "Minimum Tank Size", value: "20 gallons (tall)" },
      { icon: <Thermometer className="w-4 h-4" />, label: "Temperature", value: "72-78°F" },
      { icon: <Droplets className="w-4 h-4" />, label: "Humidity", value: "60-80%" },
    ],
    feeding: [
      { icon: <Clock className="w-4 h-4" />, label: "Adult Feeding", value: "Every 2-3 days" },
      { icon: <Utensils className="w-4 h-4" />, label: "Juvenile Feeding", value: "Daily" },
      { icon: <Heart className="w-4 h-4" />, label: "Primary Diet", value: "Commercial CGD" },
    ],
    health: [
      { icon: <CheckCircle className="w-4 h-4" />, label: "Vet Checkups", value: "Annual" },
      { icon: <Scale className="w-4 h-4" />, label: "Weight Monitoring", value: "Monthly" },
      { icon: <AlertCircle className="w-4 h-4" />, label: "Signs to Watch", value: "Lethargy, loss of appetite" },
    ]
  };

  const facts = quickFacts[category];
  if (!facts) return null;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
      <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Info className="w-4 h-4 text-emerald-400" />
        Quick Facts
      </h4>
      <div className="space-y-2">
        {facts.map((fact, index) => (
          <div key={index} className="flex items-center gap-3 text-sm">
            <span className="text-emerald-400">{fact.icon}</span>
            <span className="text-slate-400 min-w-0 flex-1">{fact.label}:</span>
            <span className="text-slate-200 font-medium">{fact.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function CareGuidePage() {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    const fetchSections = async () => {
      setIsLoading(true);
      try {
        const fetchedSections = await CareGuideSection.filter({ is_published: true });
        // Sort sections by category order first, then by their specific order_position
        const categoryOrder = ["general", "housing", "feeding", "handling", "health", "breeding"];
        fetchedSections.sort((a, b) => {
          const catAIndex = categoryOrder.indexOf(a.category);
          const catBIndex = categoryOrder.indexOf(b.category);
          if (catAIndex !== catBIndex) {
            return catAIndex - catBIndex;
          }
          return a.order_position - b.order_position;
        });
        setSections(fetchedSections);
        if (fetchedSections.length > 0) {
          setSelectedCategory(fetchedSections[0].category);
        }
      } catch (error) {
        console.error("Failed to load care guide sections:", error);
      }
      setIsLoading(false);
    };
    fetchSections();
  }, []);

  const groupedSections = sections.reduce((acc, section) => {
    (acc[section.category] = acc[section.category] || []).push(section);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-6xl mx-auto text-center text-slate-400">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-slate-800 rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-slate-800 rounded w-2/3 mx-auto"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-800 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Seo
        title="Crested Gecko Care Guide"
        description="Comprehensive crested gecko (Correlophus ciliatus) care guide — housing setups, ideal temperature and humidity ranges, diet including Repashy and Pangea, handling, common health issues, shedding, tail loss and regrowth, breeding season prep, egg incubation, and hatchling care. Everything a new or experienced keeper needs to know."
        path="/CareGuide"
        imageAlt="Crested gecko care and husbandry reference"
        keywords={[
          'crested gecko care',
          'crested gecko husbandry',
          'crestie care sheet',
          'Correlophus ciliatus care',
          'crested gecko diet',
          'Repashy crested gecko',
          'Pangea crested gecko diet',
          'crested gecko humidity',
          'crested gecko temperature',
          'crested gecko housing',
          'crested gecko enclosure',
          'crested gecko shedding',
          'crested gecko tail loss',
          'crested gecko hatchling care',
          'crested gecko lifespan',
          'first time gecko keeper',
        ]}
        jsonLd={CARE_GUIDE_JSON_LD}
      />
    <div className="min-h-screen bg-slate-950">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-900/30 to-slate-900 border-b border-slate-800">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-3 bg-emerald-900/30 px-4 py-2 rounded-full border border-emerald-700/30">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">Complete Care Guide</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-100 leading-tight">
              Crested Gecko Care
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto">
              Everything you need to know to provide the best care for your crested gecko,
              from basic housing to advanced breeding techniques.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Category Navigation */}
        <div className="sticky top-4 z-10 mb-8">
          <div className="bg-slate-900/80 backdrop-blur-lg rounded-xl border border-slate-700 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.keys(groupedSections).map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className={`h-auto p-4 flex flex-col items-center gap-2 transition-all duration-200 ${
                    selectedCategory === category 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' 
                      : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {categoryIcons[category]}
                  <span className="capitalize text-sm font-medium">{category}</span>
                  <Badge variant="secondary" className="text-xs">
                    {groupedSections[category].length}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {Object.keys(groupedSections).map(category => (
          <div key={category} className={`${selectedCategory === category ? 'block' : 'hidden'} space-y-6`}>
            {/* Category Header */}
            <div className="text-center space-y-4 mb-8">
              <div className="flex items-center justify-center gap-3">
                <div className={`p-3 rounded-xl ${categoryColors[category]} border`}>
                  {categoryIcons[category]}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-100 capitalize">{category}</h2>
                  <p className="text-slate-400 mt-1">{categoryDescriptions[category]}</p>
                </div>
              </div>
            </div>

            {/* Quick Facts */}
            {['housing', 'feeding', 'health'].includes(category) && (
              <QuickFactsBox category={category} />
            )}

            {/* Sections */}
            <div className="space-y-8">
              {groupedSections[category].map((section, index) => (
                <Card key={section.id} className="bg-slate-900/50 border-slate-700 shadow-xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-2xl text-slate-100 mb-2 flex items-center gap-3">
                          <span className="flex items-center justify-center w-8 h-8 bg-emerald-600 text-white rounded-lg text-sm font-bold">
                            {index + 1}
                          </span>
                          {section.title}
                        </CardTitle>
                        {section.last_updated && (
                          <div className="text-sm text-slate-500 flex items-center gap-2 mt-2">
                            <Clock className="w-4 h-4" />
                            Updated: {new Date(section.last_updated).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    {section.image_urls && section.image_urls.length > 0 && (
                      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {section.image_urls.map((url, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <img 
                              src={url} 
                              alt={`${section.title} image ${imgIndex + 1}`} 
                              className="rounded-lg object-cover w-full h-48 border border-slate-600 group-hover:border-emerald-500 transition-colors duration-200" 
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all duration-200" />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <ContentRenderer content={section.content} title={section.title} />
                    
                    {section.source_url && (
                      <div className="mt-6 pt-4 border-t border-slate-700">
                        <a 
                          href={section.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View Source
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}