package cacert

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"testing"

	"github.com/cjeanner/kustomap/internal/types"
)

func TestResolveTLSHost(t *testing.T) {
	tests := []struct {
		baseURL string
		want   string
	}{
		{"https://github.com", "api.github.com"},
		{"https://github.com/org/repo", "api.github.com"},
		{"https://gitlab.example.com", "gitlab.example.com"},
		{"https://gitlab.com", "gitlab.com"},
		{"https://ghe.example.com", "ghe.example.com"},
		{"https://custom.gitlab.io", "custom.gitlab.io"},
	}
	for _, tt := range tests {
		t.Run(tt.baseURL, func(t *testing.T) {
			got, err := resolveTLSHost(tt.baseURL)
			if err != nil {
				t.Fatalf("resolveTLSHost(%q): %v", tt.baseURL, err)
			}
			if got != tt.want {
				t.Errorf("resolveTLSHost(%q) = %q, want %q", tt.baseURL, got, tt.want)
			}
		})
	}
}

func TestUniqueHostsFromGraph(t *testing.T) {
	c := NewCollector(0)
	tests := []struct {
		name  string
		graph *types.Graph
		want  []string
	}{
		{
			name:  "nil",
			graph: nil,
			want:  nil,
		},
		{
			name:  "empty BaseURLs",
			graph: &types.Graph{BaseURLs: map[string]string{}},
			want:  nil,
		},
		{
			name: "single host",
			graph: &types.Graph{
				BaseURLs: map[string]string{"node1": "https://gitlab.example.com"},
			},
			want: []string{"gitlab.example.com"},
		},
		{
			name: "github resolves to api",
			graph: &types.Graph{
				BaseURLs: map[string]string{"node1": "https://github.com"},
			},
			want: []string{"api.github.com"},
		},
		{
			name: "deduplicated and sorted",
			graph: &types.Graph{
				BaseURLs: map[string]string{
					"node1": "https://gitlab.example.com",
					"node2": "https://github.com",
					"node3": "https://gitlab.example.com", // duplicate
				},
			},
			want: []string{"api.github.com", "gitlab.example.com"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := c.uniqueHostsFromGraph(tt.graph)
			if len(got) != len(tt.want) {
				t.Errorf("uniqueHostsFromGraph() = %v, want %v", got, tt.want)
				return
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("uniqueHostsFromGraph() = %v, want %v", got, tt.want)
					return
				}
			}
		})
	}
}

func TestCertFingerprint(t *testing.T) {
	// certFingerprint should be deterministic for the same cert
	fp := certFingerprint(&x509.Certificate{Raw: []byte{1, 2, 3}})
	if fp == "" {
		t.Error("certFingerprint returned empty")
	}
	// Same input → same output
	fp2 := certFingerprint(&x509.Certificate{Raw: []byte{1, 2, 3}})
	if fp != fp2 {
		t.Errorf("certFingerprint not deterministic: %q != %q", fp, fp2)
	}
}

// TestBundleTrustedForConnection validates that the built CA bundle from CollectAndAttach
// can be used as the sole trust store for a fresh TLS connection to github.com.
// This end-to-end test fetches the full chain from api.github.com, builds the bundle,
// then reconnects using only that bundle—no system roots—to ensure it is properly trusted.
func TestBundleTrustedForConnection(t *testing.T) {
	graph := &types.Graph{
		BaseURLs: map[string]string{"node1": "https://github.com"},
	}
	c := NewCollector(DefaultTTL)
	c.CollectAndAttach(graph)

	if graph.CABundle == "" {
		t.Fatal("CollectAndAttach produced an empty CA bundle")
	}

	pool := x509.NewCertPool()
	for block, rest := pem.Decode([]byte(graph.CABundle)); block != nil; block, rest = pem.Decode(rest) {
		if block.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			t.Fatalf("parsing bundle cert: %v", err)
		}
		pool.AddCert(cert)
	}

	cfg := &tls.Config{
		RootCAs:    pool,
		ServerName: "api.github.com",
	}
	conn, err := tls.Dial("tcp", "api.github.com:443", cfg)
	if err != nil {
		t.Fatalf("TLS dial with built bundle failed: %v", err)
	}
	defer conn.Close()

	t.Logf("TLS connection succeeded using built CA bundle")
}

// TestBundleRejectsOtherHosts validates that a bundle built for github.com cannot
// be used to verify other hosts. Using the same bundle to connect to www.google.com
// must fail, since the bundle only contains the CA chain for github.com.
func TestBundleRejectsOtherHosts(t *testing.T) {
	graph := &types.Graph{
		BaseURLs: map[string]string{"node1": "https://github.com"},
	}
	c := NewCollector(DefaultTTL)
	c.CollectAndAttach(graph)

	if graph.CABundle == "" {
		t.Fatal("CollectAndAttach produced an empty CA bundle")
	}

	pool := x509.NewCertPool()
	for block, rest := pem.Decode([]byte(graph.CABundle)); block != nil; block, rest = pem.Decode(rest) {
		if block.Type != "CERTIFICATE" {
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			t.Fatalf("parsing bundle cert: %v", err)
		}
		pool.AddCert(cert)
	}

	cfg := &tls.Config{
		RootCAs:    pool,
		ServerName: "www.google.com",
	}
	_, err := tls.Dial("tcp", "www.google.com:443", cfg)
	if err == nil {
		t.Fatal("TLS dial to www.google.com with github.com bundle should have failed, got nil error")
	}
	t.Logf("TLS correctly rejected www.google.com: %v", err)
}
