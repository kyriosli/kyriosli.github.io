module Jekyll
    class RubyConverter < Converter
        safe true
        priority :low

        def matches(ext)
            ext == ".md"
        end

        def output_ext(ext)
            ".html"
        end

        def convert(content)
            content.gsub(/\[([^\[\]\|]+)\|([^\[\]\|]+)\]/, '<ruby>\1<rp>(</rp><rt>\2</rt><rp>)</rp></ruby>')
        end
    end
end
