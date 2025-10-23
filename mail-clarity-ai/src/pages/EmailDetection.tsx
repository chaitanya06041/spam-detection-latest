import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, RefreshCw, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Email } from "@/types/spam";
import { fetchEmails, predictSpam } from "@/lib/api";
import PredictionResult from "@/components/PredictionResult";
import { toast } from "@/hooks/use-toast";

const EmailDetection = () => {
  const [timeFilter, setTimeFilter] = useState<string>("1");
  const [emails, setEmails] = useState<Email[]>([]);
  const [predictions, setPredictions] = useState<Map<string, any>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  const handleFetchEmails = async () => {
    setIsLoading(true);
    try {
      const filter = `${timeFilter}d`;
      const fetchedEmails = await fetchEmails(filter);
      setEmails(fetchedEmails);
      setPredictions(new Map());
      toast({
        title: "Emails Fetched",
        description: `Successfully loaded ${fetchedEmails.length} emails from the last ${timeFilter} day(s).`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch emails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmail = (id: string) => {
    setEmails((prev) =>
      prev.map((email) =>
        email.id === id ? { ...email, selected: !email.selected } : email
      )
    );
  };

  const toggleEmailExpand = (id: string) => {
    setExpandedEmails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      console.log("Email expand toggled", { id, expanded: newSet.has(id) });
      return newSet;
    });
  };

  const filteredEmails = emails.filter((email) =>
    email.from.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePredict = async () => {
    const selectedEmails = emails.filter((e) => e.selected);
    if (selectedEmails.length === 0) {
      toast({
        title: "No Emails Selected",
        description: "Please select at least one email to analyze.",
        variant: "destructive",
      });
      return;
    }

    setIsPredicting(true);
    try {
      const emailData = selectedEmails.map((email) => ({
        sender: email.from,
        subject: email.subject,
        content: email.preview,
      }));

      const type = "email"
      const results = await predictSpam(emailData, type);
      const newPredictions = new Map();

      selectedEmails.forEach((email) => {
        const key = email.from + email.subject;
        const result = results.get(key);
        if (result) {
          newPredictions.set(email.id, result);
        }
      });

      setPredictions(newPredictions);
      toast({
        title: "Analysis Complete",
        description: `Analyzed ${selectedEmails.length} email(s) successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze emails. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Email Spam Detection
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Fetch Emails
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 day</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="15">Last 15 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleFetchEmails} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Fetch Emails
                </>
              )}
            </Button>
          </div>
          {emails.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by sender name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {emails.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Select Emails to Analyze</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredEmails.map((email) => {
                const isExpanded = expandedEmails.has(email.id);
                return (
                  <div
                    key={email.id}
                    className="flex items-start gap-3 p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <Checkbox
                      checked={email.selected || false}
                      onCheckedChange={() => handleSelectEmail(email.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold truncate">{email.from}</p>
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {email.date.toLocaleDateString()}
                        </p>
                      </div>
                      <p className="font-medium text-sm mb-1 truncate">{email.subject}</p>
                      <p className={`text-sm text-muted-foreground transition-all break-words ${isExpanded ? "max-h-none" : "line-clamp-2"}`}>
                        {email.preview}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEmailExpand(email.id);
                      }}
                      className="shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button size="lg" onClick={handlePredict} disabled={isPredicting} className="px-8">
              {isPredicting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Predicting...
                </>
              ) : (
                "Predict Selected Emails"
              )}
            </Button>
          </div>
        </>
      )}

      {predictions.size > 0 && (
        <div className="space-y-8">
          <h3 className="text-2xl font-bold">Analysis Results</h3>
          {emails
            .filter((e) => predictions.has(e.id))
            .map((email) => (
              <div key={email.id}>
                <PredictionResult
                  result={predictions.get(email.id)}
                  emailInfo={{ from: email.from, subject: email.subject }}
                />
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default EmailDetection;
