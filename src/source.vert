#version 300 es

in vec2 a_position;
out vec2 v_uv;

void main() {
    
    // Map from [-1,1] to [0,1] for UV coordinates.
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);

}