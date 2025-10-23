import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Send } from "lucide-react";
import { predictSpam } from "@/lib/api";
import PredictionResult from "@/components/PredictionResult";
import { toast } from "@/hooks/use-toast";

const ManualInput = () => {
  const [message, setMessage] = useState("");
  const [prediction, setPrediction] = useState<any>(null);

  const handlePredict = async () => {
    if (!message.trim()) {
      toast({
        title: "Empty Message",
        description: "Please enter a message to analyze.",
        variant: "destructive",
      });
      return;
    }

    try {
      const emailData = [{
        sender: "Manual Input",
        subject: "Manual Analysis",
        content: message,
      }];
      const type = "manual"

      const results = await predictSpam(emailData, type);
      const result = results.get("Manual InputManual Analysis");

      if (result) {
        setPrediction(result);
        toast({
          title: "Analysis Complete",
          description: "Your message has been analyzed successfully.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClear = () => {
    setMessage("");
    setPrediction(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Manual Spam Check
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Enter Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Paste your email content or message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[200px]"
          />
          <div className="flex gap-3">
            <Button onClick={handlePredict} className="flex-1">
              <Send className="mr-2 h-4 w-4" />
              Analyze Message
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {prediction && (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">Analysis Result</h3>
          <PredictionResult result={prediction} />
        </div>
      )}
    </div>
  );
};

export default ManualInput;
