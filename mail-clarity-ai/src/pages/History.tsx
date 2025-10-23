import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Mail, FileText, Calendar, ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react";
import { HistoryItem } from "@/types/spam";
import { getHistory, deleteHistory, clearAllHistory } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

const ITEMS_PER_PAGE = 5;

const History = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("30d");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [typeFilters, setTypeFilters] = useState<Set<"email" | "manual">>(
    new Set(["email", "manual"]),
  );

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleTypeFilterChange = (type: "email" | "manual") => {
    setTypeFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  useEffect(() => {
    let filtered = history;

    // Apply date filter
    const now = new Date();
    filtered = filtered.filter((item) => {
      const daysDiff = Math.floor((now.getTime() - item.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateFilter === "1d") return daysDiff < 1;
      if (dateFilter === "7d") return daysDiff < 7;
      if (dateFilter === "15d") return daysDiff < 15;
      return true; // 30d
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => 
        item.content.message.toLowerCase().includes(searchLower) ||
        item.content.from?.toLowerCase().includes(searchLower) ||
        item.content.subject?.toLowerCase().includes(searchLower)
      );
    }

    // Apply type filter
    filtered = filtered.filter((item) => typeFilters.has(item.type));

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortOrder === "asc") {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    setFilteredHistory(filtered);
    setCurrentPage(1);
  }, [searchQuery, history, dateFilter, typeFilters, sortOrder]);

  const loadHistory = async () => {
    try {
      const items = await getHistory();      setHistory(items);
      setFilteredHistory(items); // Initial set, will be sorted by useEffect
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load history.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHistory([id]);
      loadHistory();
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      toast({
        title: "Deleted",
        description: "History item deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete history item.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteHistory(Array.from(selectedIds));
      loadHistory();
      setSelectedIds(new Set());
      toast({
        title: "Deleted",
        description: `${selectedIds.size} item(s) deleted successfully.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete selected items.",
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllHistory();
      loadHistory();
      setSelectedIds(new Set());
      toast({
        title: "Cleared",
        description: "All history has been cleared.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear history.",
        variant: "destructive",
      });
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Prediction History
        </h2>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search & Manage</CardTitle>
            <Button variant="ghost" size="icon" onClick={handleSortToggle}>
              {sortOrder === 'desc' ? <ArrowDown className="h-4 w-4"/> : <ArrowUp className="h-4 w-4"/>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by message, sender, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { value: "1d", label: "Last 1 Day" },
              { value: "7d", label: "Last 7 Days" },
              { value: "15d", label: "Last 15 Days" },
              { value: "30d", label: "Last 30 Days" },
            ].map((option) => (
              <Button
                key={option.value}
                variant={dateFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(option.value)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              variant={typeFilters.has("email") ? "default" : "outline"}
              size="sm"
              onClick={() => handleTypeFilterChange("email")}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email
            </Button>
            <Button
              variant={typeFilters.has("manual") ? "default" : "outline"}
              size="sm"
              onClick={() => handleTypeFilterChange("manual")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Manual
            </Button>
          </div>
          <div className="flex gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={selectedIds.size === 0}
                  size="sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selectedIds.size} selected item(s) from your history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={history.length === 0}
                  size="sm"
                >
                  Clear All History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All History?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {history.length} item(s) from your history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {paginatedHistory.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? "No results found." : "No history yet. Start analyzing emails and messages!"}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedHistory.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => handleSelectItem(item.id)}
                    />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          {item.type === "email" ? (
                            <Mail className="h-4 w-4 text-primary" />
                          ) : (
                            <FileText className="h-4 w-4 text-primary" />
                          )}
                          <Badge variant="outline">
                            {item.type === "email" ? "Email" : "Manual"}
                          </Badge>
                          <Badge
                            variant={item.result.model_prediction === "spam" ? "destructive" : "default"}
                            className={item.result.model_prediction !== "spam" ? "bg-success hover:bg-success" : ""}
                          >
                            {item.result.model_prediction}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </p>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this history item.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {item.content.from && (
                        <p className="text-sm">
                          <span className="font-semibold">From:</span> {item.content.from}
                        </p>
                      )}
                      {item.content.subject && (
                        <p className="text-sm">
                          <span className="font-semibold">Subject:</span> {item.content.subject}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 break-all overflow-hidden">
                        {item.content.message}
                      </p>

                      {item.result.gemini_prediction.spam_words.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.result.gemini_prediction.spam_words.map((word, idx) => (
                            <Badge key={idx} variant="outline" className="border-destructive text-destructive text-xs">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-2 px-4">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default History;
