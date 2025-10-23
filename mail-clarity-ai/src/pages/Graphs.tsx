import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { getHistory } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";

const Graphs = () => {
  const [spamGraphData, setSpamGraphData] = useState<{ name: string; spam: number; "not spam": number }[]>([]);
  const [filter, setFilter] = useState("30d");
  const [typeGraphData, setTypeGraphData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGraphData();
  }, [filter]);

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const data = await getHistory();
      
      // Filter data based on selected date range
      const now = new Date();
      const filteredData = data.filter((item) => {
        const itemDate = new Date(item.timestamp);
        const daysDiff = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (filter === "1d") return daysDiff < 1;
        if (filter === "7d") return daysDiff < 7;
        if (filter === "15d") return daysDiff < 15;
        return true; // 30d
      });

      // Process data for spam vs not spam graph
      const spamCount = filteredData.filter((item) => item.result.model_prediction === "spam").length;
      const notSpamCount = filteredData.filter((item) => item.result.model_prediction === "not spam").length;

      setSpamGraphData([
        {
          name: "Predictions",
          spam: spamCount,
          "not spam": notSpamCount,
        },
      ]);

      // Process data for email vs manual graph
      const emailCount = filteredData.filter((item) => item.type === "email").length;
      const manualCount = filteredData.filter((item) => item.type === "manual").length;

      setTypeGraphData([
        { name: "Email", value: emailCount },
        { name: "Manual", value: manualCount },
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load graph data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--secondary-foreground))"];


  const filterOptions = [
    { value: "1d", label: "Last 1 Day" },
    { value: "7d", label: "Last 7 Days" },
    { value: "15d", label: "Last 15 Days" },
    { value: "30d", label: "Last 30 Days" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Analytics
        </h2>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Spam Detection Statistics</CardTitle>
            <div className="flex gap-2">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(option.value)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : spamGraphData.length > 0 && (spamGraphData[0].spam > 0 || spamGraphData[0]["not spam"] > 0) ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={spamGraphData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-foreground" />
                <YAxis className="text-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                <Bar dataKey="spam" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="not spam" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">
                No data available for the selected date range.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email vs. Manual Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : typeGraphData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={typeGraphData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeGraphData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-96">
              <p className="text-muted-foreground">No data available for the selected date range.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Graphs;
