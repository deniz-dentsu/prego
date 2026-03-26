import { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Search, ScanBarcode, Utensils, Info, AlertTriangle, CheckCircle, ChevronLeft, Loader2, AlertCircle, Droplets } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Tab = 'product' | 'food' | 'dish' | 'skincare';

interface EvaluationResult {
  name: string;
  status: 'Safe' | 'Caution' | 'Avoid';
  summary: string;
  details: string;
  sources: { name: string; url: string }[];
  ingredients?: string[];
  nutrition?: { nutrient: string; amount: string }[];
  recipeTips?: string[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('product');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dishName, setDishName] = useState('');

  const webcamRef = useRef<Webcam>(null);

  const handleCapture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setError("Could not capture image. Please make sure camera permissions are granted.");
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setResult(null);

    try {
      const base64Data = imageSrc.split(',')[1];
      
      const prompt = activeTab === 'product' 
        ? "Analyze this image of a food product's barcode or ingredients list. Identify the product and its ingredients, and evaluate its safety for a pregnant woman based on WHO and Netherlands Voedingscentrum guidelines. Also provide approximate key nutritional values (macros, vitamins, minerals) and healthy recipe tips."
        : activeTab === 'skincare'
        ? "Analyze this image of a skincare product's barcode or ingredients list. Identify the product and its ingredients, and evaluate its safety for a pregnant woman based on strict institutional medical guidelines including ACOG, AAD, WHO, and Dutch institutions like RIVM and NVDV. Be highly conservative: flag all chemical sunscreen filters (like Ethylhexyl Salicylate, Oxybenzone, Octinoxate) and salicylates as 'Caution'. In the details, clearly explain that while low topical absorption is often considered safe by many institutions, it is flagged out of an abundance of caution so the user knows it's not alarming, but 100% mineral alternatives (Zinc Oxide, Titanium Dioxide) are preferred during pregnancy."
        : "Analyze this image of a food item. Identify the food and evaluate its safety for a pregnant woman based on WHO and Netherlands Voedingscentrum guidelines. Also provide approximate key nutritional values (macros, vitamins, minerals) and healthy recipe tips.";

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the product or food" },
              status: { type: Type.STRING, description: "Safety status: 'Safe', 'Caution', or 'Avoid'" },
              summary: { type: Type.STRING, description: "Short summary of safety" },
              details: { type: Type.STRING, description: "Detailed explanation based on WHO and Voedingscentrum" },
              sources: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Name of the source (e.g., ACOG, WHO)" },
                    url: { type: Type.STRING, description: "Valid URL link to the source material" }
                  },
                  required: ["name", "url"]
                }, 
                description: "Sources used for evaluation with links" 
              },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key ingredients identified" },
              nutrition: { 
                type: Type.ARRAY, 
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nutrient: { type: Type.STRING, description: "Name of the nutrient (e.g., Protein, Iron, Folic Acid)" },
                    amount: { type: Type.STRING, description: "Approximate amount (e.g., 10g, 50mg)" }
                  },
                  required: ["nutrient", "amount"]
                },
                description: "Approximate nutritional values (vitamins, minerals, macros) relevant to pregnancy"
              },
              recipeTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Healthy recipe tips or serving suggestions for pregnancy" }
            },
            required: ["name", "status", "summary", "details", "sources"]
          }
        }
      });

      if (response.text) {
        setResult(JSON.parse(response.text));
      } else {
        setError("Failed to generate evaluation.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during evaluation.");
    } finally {
      setIsEvaluating(false);
    }
  }, [activeTab]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dishName.trim()) return;

    setIsEvaluating(true);
    setError(null);
    setResult(null);

    try {
      const prompt = `Evaluate the safety of the dish "${dishName}" for a pregnant woman based on WHO and Netherlands Voedingscentrum guidelines. Also provide approximate key nutritional values (macros, vitamins, minerals) and healthy recipe tips.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the dish" },
              status: { type: Type.STRING, description: "Safety status: 'Safe', 'Caution', or 'Avoid'" },
              summary: { type: Type.STRING, description: "Short summary of safety" },
              details: { type: Type.STRING, description: "Detailed explanation based on WHO and Voedingscentrum" },
              sources: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Name of the source (e.g., ACOG, WHO)" },
                    url: { type: Type.STRING, description: "Valid URL link to the source material" }
                  },
                  required: ["name", "url"]
                }, 
                description: "Sources used for evaluation with links" 
              },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Typical key ingredients in this dish" },
              nutrition: { 
                type: Type.ARRAY, 
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nutrient: { type: Type.STRING, description: "Name of the nutrient (e.g., Protein, Iron, Folic Acid)" },
                    amount: { type: Type.STRING, description: "Approximate amount (e.g., 10g, 50mg)" }
                  },
                  required: ["nutrient", "amount"]
                },
                description: "Approximate nutritional values (vitamins, minerals, macros) relevant to pregnancy"
              },
              recipeTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Healthy recipe tips or serving suggestions for pregnancy" }
            },
            required: ["name", "status", "summary", "details", "sources"]
          }
        }
      });

      if (response.text) {
        setResult(JSON.parse(response.text));
      } else {
        setError("Failed to generate evaluation.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during evaluation.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Safe': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Caution': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Avoid': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Safe': return <CheckCircle className="w-6 h-6 text-emerald-600" />;
      case 'Caution': return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'Avoid': return <AlertCircle className="w-6 h-6 text-rose-600" />;
      default: return <Info className="w-6 h-6 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen relative text-gray-100 font-sans selection:bg-[#E65100]/20 bg-[#121212]">
      {/* Glassmorphism Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-[#E65100]/20 to-[#5D1049]/10 mix-blend-screen blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-[#5D1049]/20 to-[#E65100]/10 mix-blend-screen blur-[120px]" />
      </div>

      {/* Header */}
      <header className="bg-[#1E1E1E]/60 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          {result ? (
            <button onClick={reset} className="p-2 -ml-2 text-gray-400 hover:text-gray-100 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-10"></div>
          )}
          <h1 className="text-lg font-semibold text-gray-100">PreGO</h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-2xl text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {result ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-[#2A2A2A]/80 to-[#1E1E1E]/60 backdrop-blur-2xl rounded-3xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] border border-white/10">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2 className="text-2xl font-bold text-gray-100 leading-tight">{result.name}</h2>
                <div className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-full ${getStatusColor(result.status).split(' ')[0]}`}>
                  {getStatusIcon(result.status)}
                </div>
              </div>
              
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mb-6 ${getStatusColor(result.status)}`}>
                {result.status}
              </div>

              <p className="text-lg text-gray-300 font-medium mb-6 leading-relaxed">
                {result.summary}
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Details</h3>
                  <div className="text-gray-300 leading-relaxed prose prose-invert prose-sm">
                    <ReactMarkdown>{result.details}</ReactMarkdown>
                  </div>
                </div>

                {result.ingredients && result.ingredients.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Ingredients / Components</h3>
                    <ul className="flex flex-wrap gap-2">
                      {result.ingredients.map((ing, i) => (
                        <li key={i} className="bg-[#333333]/50 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)] text-gray-300 px-3 py-1.5 rounded-lg text-sm backdrop-blur-md">
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.nutrition && result.nutrition.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Nutritional Value (Approximate)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {result.nutrition.map((item, i) => (
                        <div key={i} className="bg-[#333333]/40 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)] p-3 rounded-xl flex flex-col backdrop-blur-md">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{item.nutrient}</span>
                          <span className="text-sm font-semibold text-gray-200">{item.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.recipeTips && result.recipeTips.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Healthy Recipe Tips</h3>
                    <ul className="space-y-2">
                      {result.recipeTips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300 leading-relaxed">
                          <span className="text-[#E65100] mt-0.5">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Sources</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.sources.map((source, i) => (
                      <a 
                        key={i} 
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-gray-400 bg-[#333333]/50 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)] hover:bg-[#444444]/70 hover:text-gray-200 transition-colors px-2 py-1 rounded-md flex items-center gap-1 backdrop-blur-md"
                      >
                        {source.name}
                        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={reset}
              className="w-full py-4 bg-gradient-to-r from-[#E65100] to-[#FF9800] text-white rounded-2xl font-medium hover:from-[#BF360C] hover:to-[#E65100] transition-all shadow-[0_8px_25px_rgba(230,81,0,0.25)] hover:shadow-[0_12px_30px_rgba(230,81,0,0.35)] active:scale-[0.98]"
            >
              Check Another Item
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#2A2A2A]/60 to-[#1E1E1E]/40 backdrop-blur-2xl rounded-3xl p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.3)] border border-white/10 flex flex-wrap sm:flex-nowrap gap-1">
              <button
                onClick={() => setActiveTab('product')}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-2xl text-sm font-medium transition-all duration-300 ${activeTab === 'product' ? 'bg-gradient-to-br from-[#E65100] to-[#FF9800] text-white shadow-[0_4px_20px_rgba(230,81,0,0.3)] scale-[1.02]' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
              >
                <ScanBarcode className="w-5 h-5 mb-1" />
                Product
              </button>
              <button
                onClick={() => setActiveTab('food')}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-2xl text-sm font-medium transition-all duration-300 ${activeTab === 'food' ? 'bg-gradient-to-br from-[#E65100] to-[#FF9800] text-white shadow-[0_4px_20px_rgba(230,81,0,0.3)] scale-[1.02]' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
              >
                <Camera className="w-5 h-5 mb-1" />
                Food
              </button>
              <button
                onClick={() => setActiveTab('dish')}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-2xl text-sm font-medium transition-all duration-300 ${activeTab === 'dish' ? 'bg-gradient-to-br from-[#E65100] to-[#FF9800] text-white shadow-[0_4px_20px_rgba(230,81,0,0.3)] scale-[1.02]' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
              >
                <Utensils className="w-5 h-5 mb-1" />
                Dish
              </button>
              <button
                onClick={() => setActiveTab('skincare')}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-2xl text-sm font-medium transition-all duration-300 ${activeTab === 'skincare' ? 'bg-gradient-to-br from-[#E65100] to-[#FF9800] text-white shadow-[0_4px_20px_rgba(230,81,0,0.3)] scale-[1.02]' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
              >
                <Droplets className="w-5 h-5 mb-1" />
                Skincare
              </button>
            </div>

            <div className="bg-gradient-to-br from-[#2A2A2A]/80 to-[#1E1E1E]/60 backdrop-blur-2xl rounded-3xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_32px_rgba(0,0,0,0.4)] border border-white/10">
              {activeTab === 'dish' ? (
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="dish" className="block text-sm font-medium text-gray-300">
                      What dish are you having?
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="dish"
                        value={dishName}
                        onChange={(e) => setDishName(e.target.value)}
                        className="block w-full pl-11 pr-4 py-4 bg-[#333333]/40 backdrop-blur-md border border-white/10 rounded-2xl text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-[#E65100]/50 focus:border-[#E65100]/50 transition-all outline-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)]"
                        placeholder="e.g. Sushi, Carbonara, Caesar Salad..."
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!dishName.trim() || isEvaluating}
                    className="w-full py-4 bg-gradient-to-r from-[#E65100] to-[#FF9800] text-white rounded-2xl font-medium hover:from-[#BF360C] hover:to-[#E65100] transition-all shadow-[0_8px_25px_rgba(230,81,0,0.25)] hover:shadow-[0_12px_30px_rgba(230,81,0,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      'Check Safety'
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-lg font-semibold text-gray-200">
                      {activeTab === 'product' ? 'Scan Product Barcode or Ingredients' : 
                       activeTab === 'skincare' ? 'Scan Skincare Barcode or Ingredients' : 
                       'Take a Photo of the Food'}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {activeTab === 'product' || activeTab === 'skincare'
                        ? 'Position the barcode or ingredients list clearly in the frame.' 
                        : 'Make sure the food is well-lit and clearly visible.'}
                    </p>
                  </div>
                  
                  <div className="relative aspect-[3/4] sm:aspect-square w-full overflow-hidden rounded-2xl bg-[#333333]/30 backdrop-blur-md border-2 border-dashed border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.2)]">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ facingMode: "environment" }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Overlay guides */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-2/3 h-1/3 border-2 border-white/30 rounded-xl"></div>
                    </div>

                    {isEvaluating && (
                      <div className="absolute inset-0 bg-[#121212]/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#E65100]" />
                        <p className="font-medium text-gray-200">Analyzing image...</p>
                        <p className="text-sm text-gray-400 mt-2">Checking guidelines</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleCapture}
                    disabled={isEvaluating}
                    className="w-full py-4 bg-gradient-to-r from-[#E65100] to-[#FF9800] text-white rounded-2xl font-medium hover:from-[#BF360C] hover:to-[#E65100] transition-all shadow-[0_8px_25px_rgba(230,81,0,0.25)] hover:shadow-[0_12px_30px_rgba(230,81,0,0.35)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Camera className="w-5 h-5" />
                    Capture & Analyze
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
