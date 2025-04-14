#version 300 es
precision mediump float;

in vec2 v_uv;
uniform sampler2D u_simulation;  // the current simulation texture
uniform sampler2D u_text;        // the text texture (with alpha)
out vec4 fragColor;

void main() {
    vec4 simColor = texture(u_simulation, v_uv);
    vec4 textColor = texture(u_text, v_uv);
    // Standard alpha blending: out = textColor.a * textColor + (1.0 - textColor.a) * simColor
    simColor.a = 1.0 - textColor.a; // Set the alpha of the simulation color to be the inverse of the text color
    fragColor = simColor * simColor.a + textColor * textColor.a; // Blend the text color with the simulation color based on the alpha of the text
}
