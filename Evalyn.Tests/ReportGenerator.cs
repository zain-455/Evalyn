using System;
using System.Collections.Generic;
using System.Linq;
using Evalyn.API.Services;
using Microsoft.ML;

namespace Evalyn.Tests;

public class ReportGenerator
{
    public static void Main(string[] args)
    {
        Console.WriteLine("# PCA Model Validation Report Data Generation");
        Console.WriteLine("---------------------------------------------");

        // 1. Train Model
        var trainingData = SyntheticBehaviorGenerator.GenerateHonestProfiles(1000, seed: 42);
        var mlContext = new MLContext(seed: 42);
        var dataView = mlContext.Data.LoadFromEnumerable(trainingData);
        
        var pipeline = mlContext.Transforms.ProjectToPrincipalComponents(
            outputColumnName: "PCAFeatures", 
            inputColumnName: "Features", 
            rank: 3)
            .Append(mlContext.Transforms.CalculateReconstructionError(
                outputColumnName: "Score", 
                inputColumnName: "PCAFeatures"));

        var model = pipeline.Fit(dataView);
        var engine = mlContext.Model.CreatePredictionEngine<AnomalyDetectionService.AnomalyInputRow, AnomalyDetectionService.AnomalyPrediction>(model);

        // 2. Evaluate Profiles
        var profiles = new Dictionary<string, List<AnomalyDetectionService.AnomalyInputRow>>
        {
            { "Honest", SyntheticBehaviorGenerator.GenerateHonestProfiles(200, seed: 100) },
            { "TabSwitcher", SyntheticBehaviorGenerator.GenerateSubProfile(SyntheticBehaviorGenerator.CheatingSubProfile.TabSwitcher, 100, seed: 101) },
            { "CopyPaster", SyntheticBehaviorGenerator.GenerateSubProfile(SyntheticBehaviorGenerator.CheatingSubProfile.CopyPaster, 100, seed: 102) },
            { "ExternalHelp", SyntheticBehaviorGenerator.GenerateSubProfile(SyntheticBehaviorGenerator.CheatingSubProfile.ExternalHelp, 100, seed: 103) },
            { "BotScript", SyntheticBehaviorGenerator.GenerateSubProfile(SyntheticBehaviorGenerator.CheatingSubProfile.BotScript, 100, seed: 104) }
        };

        var results = new Dictionary<string, List<float>>();
        foreach (var profile in profiles)
        {
            var scores = profile.Value.Select(p => engine.Predict(p).Score).ToList();
            results.Add(profile.Key, scores);
        }

        // 3. Print Stats
        Console.WriteLine("\n## Distribution Statistics");
        Console.WriteLine("| Profile | Mean | StdDev | Min | Max |");
        Console.WriteLine("|---------|------|--------|-----|-----|");
        foreach (var res in results)
        {
            var mean = res.Value.Average();
            var stdDev = Math.Sqrt(res.Value.Average(v => Math.Pow(v - mean, 2)));
            Console.WriteLine($"| {res.Key} | {mean:F4} | {stdDev:F4} | {res.Value.Min():F4} | {res.Value.Max():F4} |");
        }

        // 4. Threshold Sweep
        float optimalThreshold = 0.08f;
        Console.WriteLine($"\n## Confusion Matrix (Threshold = {optimalThreshold})");
        
        int tp = 0, fp = 0, tn = 0, fn = 0;
        
        // Honest (Negative Class)
        foreach (var s in results["Honest"])
        {
            if (s >= optimalThreshold) fp++;
            else tn++;
        }

        // All Cheaters (Positive Class)
        var cheatingProfiles = new[] { "TabSwitcher", "CopyPaster", "ExternalHelp", "BotScript" };
        foreach (var p in cheatingProfiles)
        {
            foreach (var s in results[p])
            {
                if (s >= optimalThreshold) tp++;
                else fn++;
            }
        }

        double precision = (double)tp / (tp + fp);
        double recall = (double)tp / (tp + fn);
        double f1 = 2 * (precision * recall) / (precision + recall);
        double accuracy = (double)(tp + tn) / (tp + tn + fp + fn);

        Console.WriteLine($"| Actual \\ Predicted | Cheating | Honest |");
        Console.WriteLine($"|-------------------|----------|--------|");
        Console.WriteLine($"| **Cheating**      | {tp} (TP) | {fn} (FN) |");
        Console.WriteLine($"| **Honest**        | {fp} (FP) | {tn} (TN) |");

        Console.WriteLine("\n## Performance Metrics");
        Console.WriteLine($"- Accuracy:  {accuracy:P2}");
        Console.WriteLine($"- Precision: {precision:P2}");
        Console.WriteLine($"- Recall:    {recall:P2}");
        Console.WriteLine($"- F1 Score:  {f1:F4}");

        // 5. Cohen's D
        var honestMean = results["Honest"].Average();
        var cheatingBatch = cheatingProfiles.SelectMany(p => results[p]).ToList();
        var cheatingMean = cheatingBatch.Average();
        
        var honestVar = results["Honest"].Average(v => Math.Pow(v - honestMean, 2));
        var cheatingVar = cheatingBatch.Average(v => Math.Pow(v - cheatingMean, 2));
        var pooledStdDev = Math.Sqrt((honestVar + cheatingVar) / 2);
        var cohensD = (cheatingMean - honestMean) / pooledStdDev;

        Console.WriteLine($"\n## Statistical Rigor");
        Console.WriteLine($"- Cohen's d (Honest vs Cheating): {cohensD:F4}");
    }
}
