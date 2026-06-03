from app.services.serializers import serialize_raw_content


def test_serialize_text_content():
    content = [{"type": "text", "text": "hello"}]
    result = serialize_raw_content(content)
    assert len(result) == 1
    assert result[0] == {"kind": "text", "text": "hello"}


def test_serialize_tool_use():
    content = [{"type": "tool_use", "name": "Read", "input": {"file_path": "/tmp/x"}}]
    result = serialize_raw_content(content)
    assert len(result) == 1
    assert result[0]["kind"] == "tool_use"
    assert result[0]["name"] == "Read"
    assert result[0]["input"] == {"file_path": "/tmp/x"}


def test_serialize_tool_result_string():
    content = [{"type": "tool_result", "content": "file contents here"}]
    result = serialize_raw_content(content)
    assert len(result) == 1
    assert result[0]["kind"] == "tool_result"
    assert result[0]["content"] == "file contents here"


def test_serialize_tool_result_list():
    content = [{"type": "tool_result", "content": [{"text": "line1"}, {"text": "line2"}]}]
    result = serialize_raw_content(content)
    assert len(result) == 1
    assert result[0]["content"] == "line1\nline2"


def test_serialize_thinking():
    content = [{"type": "thinking", "thinking": "internal reasoning"}]
    result = serialize_raw_content(content)
    assert len(result) == 1
    assert result[0] == {"kind": "thinking", "text": "internal reasoning"}


def test_serialize_image():
    content = [{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "abc123"}}]
    result = serialize_raw_content(content)
    assert len(result) == 1
    assert result[0]["kind"] == "image"
    assert result[0]["source"]["data"] == "abc123"


def test_serialize_empty():
    assert serialize_raw_content([]) == []


def test_serialize_non_list():
    result = serialize_raw_content("just a string")
    assert len(result) == 1
    assert result[0] == {"kind": "text", "text": "just a string"}


def test_serialize_mixed_blocks():
    content = [
        {"type": "text", "text": "thinking..."},
        {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}},
        {"type": "tool_result", "content": "file1\nfile2"},
        {"type": "text", "text": "done"},
    ]
    result = serialize_raw_content(content)
    assert len(result) == 4
    assert result[0]["kind"] == "text"
    assert result[1]["kind"] == "tool_use"
    assert result[2]["kind"] == "tool_result"
    assert result[3]["kind"] == "text"
