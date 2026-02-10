use log::warn;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetingRule {
    pub version: String,
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub attribute: String,
    pub operator: Operator,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Operator {
    Equals,
    NotEquals,
    Contains,
    Regex,
    In,
    Gt,
    Lt,
}

pub struct TargetingEngine;

impl TargetingEngine {
    pub fn evaluate(rule_json: &str, attributes: &Value) -> bool {
        let rule: TargetingRule = match serde_json::from_str(rule_json) {
            Ok(r) => r,
            Err(e) => {
                warn!(
                    "Failed to parse targeting rule: {}. Error: {}",
                    rule_json, e
                );
                return false;
            }
        };

        if rule.conditions.is_empty() {
            return true; // Empty rule matches everyone
        }

        // All conditions must be met (AND logic)
        rule.conditions
            .iter()
            .all(|cond| Self::evaluate_condition(cond, attributes))
    }

    fn evaluate_condition(condition: &Condition, attributes: &Value) -> bool {
        let attr_value = match attributes.get(&condition.attribute) {
            Some(v) => v,
            None => return false, // Attribute missing
        };

        match condition.operator {
            Operator::Equals => attr_value == &condition.value,
            Operator::NotEquals => attr_value != &condition.value,
            Operator::Contains => {
                if let (Some(val_str), Some(cond_str)) =
                    (attr_value.as_str(), condition.value.as_str())
                {
                    val_str.contains(cond_str)
                } else {
                    false
                }
            }
            Operator::Regex => {
                if let (Some(val_str), Some(regex_str)) =
                    (attr_value.as_str(), condition.value.as_str())
                {
                    match Regex::new(regex_str) {
                        Ok(re) => re.is_match(val_str),
                        Err(e) => {
                            warn!(
                                "Invalid regex in targeting rule: {}. Error: {}",
                                regex_str, e
                            );
                            false
                        }
                    }
                } else {
                    false
                }
            }
            Operator::In => {
                if let Some(arr) = condition.value.as_array() {
                    arr.iter().any(|v| v == attr_value)
                } else {
                    false
                }
            }
            Operator::Gt => {
                if let (Some(v), Some(c)) = (attr_value.as_f64(), condition.value.as_f64()) {
                    v > c
                } else {
                    false
                }
            }
            Operator::Lt => {
                if let (Some(v), Some(c)) = (attr_value.as_f64(), condition.value.as_f64()) {
                    v < c
                } else {
                    false
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_evaluate_empty_rule() {
        let rule = json!({
            "version": "1",
            "conditions": []
        })
        .to_string();
        let attrs = json!({"email": "test@example.com"});
        assert!(TargetingEngine::evaluate(&rule, &attrs));
    }

    #[test]
    fn test_evaluate_equals() {
        let rule = json!({
            "version": "1",
            "conditions": [
                {
                    "attribute": "plan",
                    "operator": "equals",
                    "value": "premium"
                }
            ]
        })
        .to_string();

        assert!(TargetingEngine::evaluate(
            &rule,
            &json!({"plan": "premium"})
        ));
        assert!(!TargetingEngine::evaluate(&rule, &json!({"plan": "free"})));
        assert!(!TargetingEngine::evaluate(&rule, &json!({})));
    }

    #[test]
    fn test_evaluate_regex() {
        let rule = json!({
            "version": "1",
            "conditions": [
                {
                    "attribute": "email",
                    "operator": "regex",
                    "value": ".*@google.com$"
                }
            ]
        })
        .to_string();

        assert!(TargetingEngine::evaluate(
            &rule,
            &json!({"email": "user@google.com"})
        ));
        assert!(!TargetingEngine::evaluate(
            &rule,
            &json!({"email": "user@gmail.com"})
        ));
    }

    #[test]
    fn test_evaluate_multiple_conditions() {
        let rule = json!({
            "version": "1",
            "conditions": [
                {
                    "attribute": "region",
                    "operator": "equals",
                    "value": "US"
                },
                {
                    "attribute": "age",
                    "operator": "gt",
                    "value": 18
                }
            ]
        })
        .to_string();

        assert!(TargetingEngine::evaluate(
            &rule,
            &json!({"region": "US", "age": 25})
        ));
        assert!(!TargetingEngine::evaluate(
            &rule,
            &json!({"region": "EU", "age": 25})
        ));
        assert!(!TargetingEngine::evaluate(
            &rule,
            &json!({"region": "US", "age": 15})
        ));
    }
}
