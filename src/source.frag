#version 300 es
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_incoming_image;
uniform float u_time;
uniform vec2 u_resolution;
uniform int u_mode;

in vec2 v_uv;
out vec4 fragColor;

const float DA = 0.1;     // Diffusion rate of A
const float DB = 0.1;     // Diffusion rate of B
const float feed = 0.02; // Feed rate
const float kill = 0.012; // Kill rate

void main() {

    vec2 texel = 1.0 / u_resolution;

    // Read center and neighbors
    vec4 center = texture(u_image, v_uv);
    float A = center.r;
    float B = center.g;
    float C = center.b; // Not used in this shader, but could be useful for other effects

    float lapA = 0.0;
    float lapB = 0.0;

    float DA = C * A / B / 10.0; // Diffusion rate of A

    // float DA = center.b / center.r / 10.10; // Diffusion rate of A
    float DB = B / C / 10.0; // Diffusion rate of B

    // Laplacian kernel (5-point stencil)
    lapA += texture(u_image, v_uv + vec2(-texel.x,  0.0)).r;
    lapA += texture(u_image, v_uv + vec2( texel.x,  0.0)).r;
    lapA += texture(u_image, v_uv + vec2( 0.0, -texel.y)).r;
    lapA += texture(u_image, v_uv + vec2( 0.0,  texel.y)).r;
    lapA -= 4.0 * A;

    lapB += texture(u_image, v_uv + vec2(-texel.x,  0.0)).g;
    lapB += texture(u_image, v_uv + vec2( texel.x,  0.0)).g;
    lapB += texture(u_image, v_uv + vec2( 0.0, -texel.y)).g;
    lapB += texture(u_image, v_uv + vec2( 0.0,  texel.y)).g;
    lapB -= 4.0 * B;

    // Gray-Scott update
    float reaction = A * B * B;
    float newA = A + (DA * lapA - reaction + feed * (1.0 - A));
    float newB = B + (DB * lapB + reaction - (kill + feed) * B);

    fragColor = vec4(newA, newB, DA+DB, 1.0);
    // fragColor = vec4(1.0, 1.0, 1.0, 1.0); // Uncomment this line to see the effect of the reaction-diffusion system
}
