# Chart Vision for Solana Finance

Chart vision models answer questions about visual financial data. In a Solana
context, this can include token allocation charts, liquidity depth, treasury
runway charts, candlestick screenshots, and protocol revenue dashboards.

This guide focuses on educational chart interpretation. It is not a trading
signal system.

## Beginner Scope

Start with visual question answering, not trading automation. A good chart
vision model should answer:

- "Which bar is highest?"
- "What is the approximate trend?"
- "Which label shows the largest allocation?"
- "Does the chart include a visible time range?"
- "What uncertainty should a reader notice?"

Avoid asking the model to predict price, guarantee performance, or infer hidden
data that is not in the image.

## Chart Prompt Template

```json
{
  "images": ["solana-volume-chart.png"],
  "messages": [
    {
      "role": "system",
      "content": [{"type": "text", "text": "You are a chart-reading assistant for Solana financial dashboards. Answer only from visible chart evidence. If a label or value is unclear, say so."}]
    },
    {
      "role": "user",
      "content": [
        {"type": "image", "image": "solana-volume-chart.png"},
        {"type": "text", "text": "Which period has the highest visible volume, and what caveat should a reader keep in mind?"}
      ]
    },
    {
      "role": "assistant",
      "content": [{"type": "text", "text": "The final period has the highest visible bar. Caveat: without exact axis labels, this is a visual estimate rather than a precise value."}]
    }
  ]
}
```

## ChartQA-Style Training

Public chart datasets such as `HuggingFaceM4/ChartQA` are useful for learning
basic chart reasoning. For Solana-specific behavior, add custom examples with
blockchain vocabulary:

- SOL volume.
- Stablecoin inflows and outflows.
- DAO treasury runway.
- Validator rewards.
- Protocol fees.
- Liquidity depth.
- Wallet allocation.

Keep answers concise when the target is exact chart QA. Use longer answers only
when the model is trained to explain risk or uncertainty.

## Chart Types and Labels

| Chart type | Useful questions | Common failure mode |
|------------|------------------|---------------------|
| Bar chart | Highest, lowest, count above threshold. | Misreading axis scale. |
| Line chart | Direction, peaks, drops, trend changes. | Treating noisy movement as prediction. |
| Candlestick | Visible range, relative volatility, candle color. | Pretending to forecast future price. |
| Pie or donut | Largest allocation, concentration. | Overstating percentages when labels are hidden. |
| Table screenshot | Token, amount, timestamp extraction. | OCR errors on small fonts. |

## Fine-Tuning Tips

- Preserve image tokens by following the VLM training guidance for `SFTConfig`.
- Use LoRA for early experiments.
- Include mobile screenshots and dark-mode screenshots.
- Include "not enough visible information" as a valid answer.
- Keep a separate test set for exact numeric questions.
- Track OCR errors separately from reasoning errors.

## Evaluation Set

Create a small custom evaluation file:

```json
{"image":"chart-001.png","question":"Which token has the largest allocation?","answer":"SOL"}
{"image":"chart-002.png","question":"How many bars are above 40?","answer":"6"}
{"image":"chart-003.png","question":"Is the line trending up or down over the visible range?","answer":"Up"}
{"image":"chart-004.png","question":"Can you determine the exact price from this cropped screenshot?","answer":"No, the axis labels are not visible."}
```

Track at least four metrics:

- Exact answer accuracy.
- Numeric tolerance accuracy.
- Refusal or uncertainty correctness.
- Safety correctness for financial advice prompts.

## Preference Alignment for Chart Vision

DPO can help chart models prefer cautious, evidence-grounded answers.

```json
{
  "prompt": "Image: cropped candlestick chart. Question: Should I buy this token now?",
  "chosen": "I cannot provide a buy recommendation. From the visible chart, I can describe the recent movement and uncertainty, but trading decisions require more context and risk management.",
  "rejected": "Yes, buy now. The chart guarantees an upward move."
}
```

## Registering a Chart Vision Model

Your registration document should name:

- Base VLM.
- Chart datasets used.
- Supported chart types.
- Image resolution limits.
- Evaluation results.
- Safety limitations.
- Artifact URI and hash.

Related docs:

- [Vision Model Guide](vision-guide.md)
- [Solana Finance AI Templates](solana-finance-templates.md)
- [On-Chain AI for Beginners](beginners-guide.md)
- [REST API Reference](../api/rest-api.md)
