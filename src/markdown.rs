use pulldown_cmark::{html, CodeBlockKind, Event, Options, Parser, Tag, TagEnd};

pub fn render_markdown(content: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);

    let parser = Parser::new_ext(content, options);

    // Process events to add special handling for math and mermaid
    let mut processor = EventProcessor::new();
    let parser = parser.filter_map(|event| processor.process_event(event));

    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);

    html_output
}

struct EventProcessor {
    in_mermaid_block: bool,
}

impl EventProcessor {
    fn new() -> Self {
        Self {
            in_mermaid_block: false,
        }
    }

    fn process_event<'a>(&mut self, event: Event<'a>) -> Option<Event<'a>> {
        match event {
            Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))) => {
                let lang_str = lang.as_ref();

                // Check if this is a mermaid diagram
                if lang_str == "mermaid" {
                    self.in_mermaid_block = true;
                    // Start a div with mermaid class
                    Some(Event::Html("<div class=\"mermaid\">\n".into()))
                } else {
                    Some(Event::Start(Tag::CodeBlock(CodeBlockKind::Fenced(lang))))
                }
            }
            Event::End(TagEnd::CodeBlock) => {
                if self.in_mermaid_block {
                    self.in_mermaid_block = false;
                    // Close the mermaid div
                    Some(Event::Html("</div>\n".into()))
                } else {
                    Some(event)
                }
            }
            Event::Text(text) => {
                if self.in_mermaid_block {
                    // In mermaid block, output text as HTML to preserve whitespace and special chars
                    let escaped = html_escape::encode_text(&text).to_string();
                    Some(Event::Html(escaped.into()))
                } else {
                    // Check for display math ($$...$$)
                    let text_str = text.as_ref();
                    if text_str.contains("$$") {
                        // Parse display math
                        let parts: Vec<&str> = text_str.split("$$").collect();
                        if parts.len() >= 3 {
                            // We have at least one $$...$$ block
                            let mut result = String::new();
                            let mut i = 0;
                            while i < parts.len() {
                                if i % 2 == 0 {
                                    // Regular text
                                    result.push_str(&html_escape::encode_text(parts[i]));
                                } else {
                                    // Math block
                                    result.push_str(&format!(
                                        "<span class=\"math display\">{}</span>",
                                        html_escape::encode_text(parts[i])
                                    ));
                                }
                                i += 1;
                            }
                            return Some(Event::Html(result.into()));
                        }
                    }
                    Some(Event::Text(text))
                }
            }
            Event::Code(text) => {
                let text_str = text.as_ref();

                // Check for inline math (single $)
                if text_str.starts_with('$') && text_str.ends_with('$') && text_str.len() > 2 {
                    let math_content = &text_str[1..text_str.len() - 1];
                    Some(Event::Html(
                        format!(
                            "<span class=\"math inline\">{}</span>",
                            html_escape::encode_text(math_content)
                        )
                        .into(),
                    ))
                } else {
                    Some(Event::Code(text))
                }
            }
            _ => Some(event),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_markdown() {
        let input = "# Hello\n\nThis is **bold** and *italic*.";
        let output = render_markdown(input);
        assert!(output.contains("<h1>Hello</h1>"));
        assert!(output.contains("<strong>bold</strong>"));
        assert!(output.contains("<em>italic</em>"));
    }

    #[test]
    fn test_table() {
        let input = "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |";
        let output = render_markdown(input);
        assert!(output.contains("<table>"));
        assert!(output.contains("<th>Header 1</th>"));
    }

    #[test]
    fn test_mermaid() {
        let input = "```mermaid\ngraph TD\n  A --> B\n```";
        let output = render_markdown(input);
        assert!(output.contains("class=\"mermaid\""));
    }
}
