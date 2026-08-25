from ..ml.model_loader import load_ml_model


class PredictionService:
    def __init__(self):
        # Load the joblib model pipeline
        self.model = load_ml_model()

    def predict_risk(self, sender: str, subject: str, body: str, indicators: list) -> tuple:
        """
        Combines machine learning prediction probabilities with rule-based heuristics
        weights to return: (classification, risk_score, confidence).
        """
        text_payload = f"{sender} {subject} {body}"

        # 1. Obtain classification probabilities from ML pipeline
        try:
            probs = self.model.predict_proba([text_payload])[0]
            # Probabilities of class 1 (phishing)
            ml_phish_prob = float(probs[1])
        except Exception:
            ml_phish_prob = 0.1

        # 2. Heuristics score adjustments
        severity_score = 15
        for ind in indicators:
            if ind["severity"] == "critical":
                severity_score += 35
            elif ind["severity"] == "high":
                severity_score += 25
            elif ind["severity"] == "medium":
                severity_score += 15
            else:
                severity_score += 5

        # Cap base heuristics score at 95
        severity_score = min(severity_score, 95)

        # 3. Blended risk score calculation
        # Blend ML probability (60% weight) with heuristics severity (40% weight)
        blended_score = int((ml_phish_prob * 100 * 0.6) + (severity_score * 0.4))
        blended_score = max(0, min(100, blended_score))

        # 4. Classify based on blended score boundaries
        if blended_score >= 70:
            classification = "phishing"
            confidence = 85.0 + (ml_phish_prob * 14.0) if ml_phish_prob > 0.5 else 85.0
        elif blended_score >= 35:
            classification = "suspicious"
            confidence = 70.0 + (abs(0.5 - ml_phish_prob) * 20.0)
        else:
            classification = "safe"
            confidence = 88.0 + ((1.0 - ml_phish_prob) * 11.0) if ml_phish_prob < 0.5 else 88.0

        return classification, blended_score, round(min(100.0, confidence), 1)


prediction_service = PredictionService()
