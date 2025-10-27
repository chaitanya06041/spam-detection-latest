import { SpamDetectionResult } from "@/types/spam";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, ShieldAlert, Lightbulb, AlertTriangle } from "lucide-react";

interface PredictionResultProps {
  result: SpamDetectionResult;
  emailInfo?: {
    from?: string;
    subject?: string;
  };
}

const PredictionResult = ({ result, emailInfo }: PredictionResultProps) => {
  const isSpam = result.model_prediction === "spam";

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Model Prediction */}
      <Card className="border-2 transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Model Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emailInfo && (
            <div className="mb-4 p-3 bg-muted rounded-lg text-sm space-y-1">
              {emailInfo.from && (
                <p className="text-muted-foreground">
                  <span className="font-medium">From:</span> {emailInfo.from}
                </p>
              )}
              {emailInfo.subject && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Subject:</span> {emailInfo.subject}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-center py-8">
            {isSpam ? (
              <div className="text-center space-y-4">
                <div className="bg-destructive/10 p-6 rounded-full inline-block">
                  <AlertCircle className="h-16 w-16 text-destructive" />
                </div>
                <Badge variant="destructive" className="text-lg px-6 py-2">
                  SPAM DETECTED
                </Badge>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="bg-success/10 p-6 rounded-full inline-block">
                  <CheckCircle className="h-16 w-16 text-success" />
                </div>
                <Badge className="text-lg px-6 py-2 bg-success hover:bg-success">
                  NOT SPAM
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gemini Analysis */}
      <Card className="border-2 transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Detection Result</h4>
                <Badge variant={result.gemini_prediction.prediction === "spam" ? "destructive" : "default"}
                  className={result.gemini_prediction.prediction !== "spam" ? "bg-success hover:bg-success" : ""}>
                  {result.gemini_prediction.prediction.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary"></span>
              Reason
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {result.gemini_prediction.reason}
            </p>
          </div>

          {result.gemini_prediction.spam_words.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive"></span>
                Suspicious Words Detected
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.gemini_prediction.spam_words.map((word, index) => (
                  <Badge key={index} variant="outline" className="border-destructive text-destructive">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent"></span>
              Recommendation
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {result.gemini_prediction.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PredictionResult;
